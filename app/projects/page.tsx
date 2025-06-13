import { ProjectsPage } from '@/src/components/projects';
import { ProjectProvider } from '@/src/contexts/ProjectContext';

export default function ProjectsRoute() {
  return (
    <ProjectProvider>
      <ProjectsPage />
    </ProjectProvider>
  );
}