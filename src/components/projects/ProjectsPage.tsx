'use client';

import React, { useState } from 'react';
import { useProject } from '@/src/contexts/ProjectContext';
import { Project } from '@/src/types/project';
import { ProjectList } from './ProjectList';
import { ProjectDashboard } from './ProjectDashboard';
import { ProjectCreateModal } from './ProjectCreateModal';
import { ProjectEditModal } from './ProjectEditModal';
import { ProjectDeleteModal } from './ProjectDeleteModal';
import { ProjectExportModal } from './ProjectExportModal';
import { ProjectImportModal } from './ProjectImportModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { ProjectDuplicateModal } from './ProjectDuplicateModal';
import { ArchivedProjectsPage } from './ArchivedProjectsPage';
import { Archive, Upload } from 'lucide-react';
// import Link from 'next/link';

export const ProjectsPage: React.FC = () => {
  const { currentProject, archiveProject, projects } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const handleArchive = async (projectId?: string) => {
    const id = projectId || currentProject?.id;
    if (id) {
      try {
        await archiveProject(id);
      } catch (error) {
        // Failed to archive project
      }
    }
  };

  const handleEditClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setShowEditModal(true);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setShowDeleteModal(true);
    }
  };

  const handleExportClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setShowExportModal(true);
    }
  };

  const handleDuplicateClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setShowDuplicateModal(true);
    }
  };

  const handleSettingsClick = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setSelectedProject(project);
      setShowSettingsModal(true);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showArchived
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Archive className="w-4 h-4" />
            Archived Projects
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Project
          </button>
        </div>
      </div>

      {/* Main Content */}
      {showArchived ? (
        <ArchivedProjectsPage />
      ) : currentProject ? (
        <ProjectDashboard
          project={currentProject}
          onEdit={() => {
            setSelectedProject(currentProject);
            setShowEditModal(true);
          }}
          onArchive={() => handleArchive()}
          onDelete={() => {
            setSelectedProject(currentProject);
            setShowDeleteModal(true);
          }}
          onExport={() => {
            setSelectedProject(currentProject);
            setShowExportModal(true);
          }}
          onDuplicate={() => {
            setSelectedProject(currentProject);
            setShowDuplicateModal(true);
          }}
          onSettings={() => {
            setSelectedProject(currentProject);
            setShowSettingsModal(true);
          }}
        />
      ) : (
        <ProjectList 
          onCreateClick={() => setShowCreateModal(true)}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
          onExportClick={handleExportClick}
          onDuplicateClick={handleDuplicateClick}
          onSettingsClick={handleSettingsClick}
          onArchiveClick={handleArchive}
        />
      )}

      {/* Modals */}
      <ProjectCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {selectedProject && (
        <>
          <ProjectEditModal
            project={selectedProject}
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedProject(null);
            }}
          />

          <ProjectDeleteModal
            project={selectedProject}
            isOpen={showDeleteModal}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedProject(null);
            }}
          />

          <ProjectExportModal
            project={selectedProject}
            isOpen={showExportModal}
            onClose={() => {
              setShowExportModal(false);
              setSelectedProject(null);
            }}
          />

          <ProjectSettingsModal
            project={selectedProject}
            isOpen={showSettingsModal}
            onClose={() => {
              setShowSettingsModal(false);
              setSelectedProject(null);
            }}
          />

          <ProjectDuplicateModal
            project={selectedProject}
            isOpen={showDuplicateModal}
            onClose={() => {
              setShowDuplicateModal(false);
              setSelectedProject(null);
            }}
          />
        </>
      )}

      <ProjectImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};