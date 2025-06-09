import * as fs from 'fs';
// import * as path from 'path';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

const pipelineAsync = promisify(pipeline);

interface DocumentChunk {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
}

interface AnalysisResult {
  documentId: string;
  filePath: string;
  fileSize: number;
  chunks: number;
  totalLines: number;
  totalWords: number;
  hash: string;
  processingTime: number;
  metadata: Record<string, any>;
}

interface StreamingOptions {
  chunkSize: number;
  parallel: boolean;
  workerCount: number;
  cacheEnabled: boolean;
}

export class OptimizedDocumentAnalyzer extends EventEmitter {
  private static instance: OptimizedDocumentAnalyzer;
  private cache: Map<string, AnalysisResult> = new Map();
  private workers: Worker[] = [];
  private activeAnalyses: Map<string, AbortController> = new Map();

  private readonly defaultOptions: StreamingOptions = {
    chunkSize: 64 * 1024, // 64KB chunks
    parallel: true,
    workerCount: Math.max(1, require('os').cpus().length - 1),
    cacheEnabled: true,
  };

  private constructor() {
    super();
    this.initializeWorkers();
  }

  static getInstance(): OptimizedDocumentAnalyzer {
    if (!OptimizedDocumentAnalyzer.instance) {
      OptimizedDocumentAnalyzer.instance = new OptimizedDocumentAnalyzer();
    }
    return OptimizedDocumentAnalyzer.instance;
  }

  private initializeWorkers(): void {
    // Worker initialization will be done on demand
  }

  async analyzeDocument(
    filePath: string,
    options: Partial<StreamingOptions> = {}
  ): Promise<AnalysisResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      // Check cache first
      if (opts.cacheEnabled) {
        const cached = await this.getCachedResult(filePath);
        if (cached) {
          this.emit('cache-hit', { filePath, result: cached });
          return cached;
        }
      }

      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;

      // Use streaming for large files (> 10MB)
      if (fileSize > 10 * 1024 * 1024) {
        return await this.analyzeStreamingDocument(filePath, opts, startTime);
      } else {
        return await this.analyzeSmallDocument(filePath, opts, startTime);
      }
    } catch (error) {
      this.emit('error', { filePath, error });
      throw error;
    }
  }

  private async analyzeSmallDocument(
    filePath: string,
    options: StreamingOptions,
    startTime: number
  ): Promise<AnalysisResult> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const hash = createHash('sha256').update(content).digest('hex');

    const result: AnalysisResult = {
      documentId: hash.substring(0, 16),
      filePath,
      fileSize: Buffer.byteLength(content),
      chunks: 1,
      totalLines: lines.length,
      totalWords: words.length,
      hash,
      processingTime: Date.now() - startTime,
      metadata: {
        method: 'in-memory',
        encoding: 'utf-8',
      },
    };

    if (options.cacheEnabled) {
      this.cache.set(filePath, result);
    }

    this.emit('analysis-complete', result);
    return result;
  }

  private async analyzeStreamingDocument(
    filePath: string,
    options: StreamingOptions,
    startTime: number
  ): Promise<AnalysisResult> {
    const abortController = new AbortController();
    this.activeAnalyses.set(filePath, abortController);

    try {
      const stats = await fs.promises.stat(filePath);
      const chunks: DocumentChunk[] = [];
      let totalLines = 0;
      let totalWords = 0;
      let currentLine = 0;
      let currentByte = 0;
      const hash = createHash('sha256');

      // Create line counter transform
      const lineCounter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          const text = chunk.toString();
          const lines = text.split('\n');
          totalLines += lines.length - 1;
          totalWords += text.split(/\s+/).filter(w => w.length > 0).length;
          hash.update(chunk);
          
          // Emit progress
          currentByte += chunk.length;
          // const progress = (currentByte / stats.size) * 100;
          this.push(chunk);
          callback();
        },
      });

      // Create chunk processor
      const chunkProcessor = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          if (abortController.signal.aborted) {
            callback(new Error('Analysis aborted'));
            return;
          }

          const chunkData: DocumentChunk = {
            id: createHash('md5').update(chunk).digest('hex').substring(0, 8),
            content: chunk.toString(),
            startLine: currentLine,
            endLine: currentLine + chunk.toString().split('\n').length - 1,
            startByte: currentByte,
            endByte: currentByte + chunk.length,
          };

          chunks.push(chunkData);
          currentLine = chunkData.endLine;
          
          this.push(chunk);
          callback();
        },
      });

      // Setup streaming pipeline
      const readStream = fs.createReadStream(filePath, {
        highWaterMark: options.chunkSize,
        signal: abortController.signal,
      });

      await pipelineAsync(
        readStream,
        lineCounter,
        chunkProcessor,
        fs.createWriteStream('/dev/null') // Discard output
      );

      const result: AnalysisResult = {
        documentId: hash.digest('hex').substring(0, 16),
        filePath,
        fileSize: stats.size,
        chunks: chunks.length,
        totalLines,
        totalWords,
        hash: hash.digest('hex'),
        processingTime: Date.now() - startTime,
        metadata: {
          method: 'streaming',
          chunkSize: options.chunkSize,
          encoding: 'utf-8',
        },
      };

      if (options.cacheEnabled) {
        this.cache.set(filePath, result);
      }

      this.emit('analysis-complete', result);
      return result;

    } finally {
      this.activeAnalyses.delete(filePath);
    }
  }

  async analyzeDocumentParallel(
    filePath: string,
    options: Partial<StreamingOptions> = {}
  ): Promise<AnalysisResult> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    try {
      const stats = await fs.promises.stat(filePath);
      const fileSize = stats.size;
      const workerCount = Math.min(opts.workerCount, Math.ceil(fileSize / (1024 * 1024))); // 1 worker per MB
      
      if (workerCount <= 1) {
        return await this.analyzeDocument(filePath, opts);
      }

      // Split file into chunks for parallel processing
      const chunkSize = Math.ceil(fileSize / workerCount);
      const workerPromises: Promise<Partial<AnalysisResult>>[] = [];

      for (let i = 0; i < workerCount; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        
        workerPromises.push(this.analyzeChunkInWorker(filePath, start, end));
      }

      const results = await Promise.all(workerPromises);
      
      // Combine results
      const combinedResult: AnalysisResult = {
        documentId: createHash('md5').update(filePath).digest('hex').substring(0, 16),
        filePath,
        fileSize,
        chunks: workerCount,
        totalLines: results.reduce((sum, r) => sum + (r.totalLines || 0), 0),
        totalWords: results.reduce((sum, r) => sum + (r.totalWords || 0), 0),
        hash: createHash('sha256').update(filePath).digest('hex'),
        processingTime: Date.now() - startTime,
        metadata: {
          method: 'parallel',
          workerCount,
          chunkSize,
        },
      };

      if (opts.cacheEnabled) {
        this.cache.set(filePath, combinedResult);
      }

      this.emit('analysis-complete', combinedResult);
      return combinedResult;

    } catch (error) {
      this.emit('error', { filePath, error });
      throw error;
    }
  }

  private async analyzeChunkInWorker(
    filePath: string,
    start: number,
    end: number
  ): Promise<Partial<AnalysisResult>> {
    return new Promise((resolve, reject) => {
      // Simulate worker processing (in production, use actual Worker threads)
      fs.open(filePath, 'r', async (err, fd) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const bufferSize = end - start;
          const buffer = Buffer.alloc(bufferSize);
          
          await promisify(fs.read)(fd, buffer, 0, bufferSize, start);
          
          const content = buffer.toString('utf-8');
          const lines = content.split('\n').length;
          const words = content.split(/\s+/).filter(w => w.length > 0).length;

          resolve({
            totalLines: lines,
            totalWords: words,
          });
        } catch (error) {
          reject(error);
        } finally {
          fs.close(fd, () => {});
        }
      });
    });
  }

  // Advanced features for production
  async analyzeWithTimeout(
    filePath: string,
    timeoutMs: number,
    options?: Partial<StreamingOptions>
  ): Promise<AnalysisResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout')), timeoutMs);
    });

    try {
      return await Promise.race([
        this.analyzeDocument(filePath, options),
        timeoutPromise,
      ]);
    } catch (error) {
      this.abortAnalysis(filePath);
      throw error;
    }
  }

  abortAnalysis(filePath: string): void {
    const controller = this.activeAnalyses.get(filePath);
    if (controller) {
      controller.abort();
      this.activeAnalyses.delete(filePath);
      this.emit('analysis-aborted', { filePath });
    }
  }

  private async getCachedResult(filePath: string): Promise<AnalysisResult | null> {
    const cached = this.cache.get(filePath);
    if (!cached) return null;

    // Verify file hasn't changed
    try {
      const stats = await fs.promises.stat(filePath);
      const currentMtime = stats.mtime.getTime();
      
      // Simple freshness check (in production, use more sophisticated caching)
      if (Date.now() - currentMtime > 3600000) { // 1 hour
        this.cache.delete(filePath);
        return null;
      }

      return cached;
    } catch {
      this.cache.delete(filePath);
      return null;
    }
  }

  // Memory optimization
  clearCache(): void {
    const oldSize = this.cache.size;
    this.cache.clear();
    this.emit('cache-cleared', { entriesCleared: oldSize });
  }

  getCacheStats(): { size: number; entries: number } {
    let totalSize = 0;
    this.cache.forEach(result => {
      totalSize += result.fileSize;
    });

    return {
      size: totalSize,
      entries: this.cache.size,
    };
  }

  // Cleanup
  dispose(): void {
    this.activeAnalyses.forEach(controller => controller.abort());
    this.activeAnalyses.clear();
    this.cache.clear();
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.removeAllListeners();
  }
}