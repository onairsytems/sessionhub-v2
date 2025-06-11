declare module '@axe-core/playwright' {
  export default class AxeBuilder {
    constructor(options: { page: any });
    withTags(tags: string[]): AxeBuilder;
    options(options: any): AxeBuilder;
    analyze(): Promise<{ violations: any[] }>;
  }
}

declare module 'gray-matter' {
  export default function matter(content: string): {
    data: any;
    content: string;
  };
}