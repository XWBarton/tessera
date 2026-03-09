import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminRoute from './components/layout/AdminRoute'
import SetupGuard from './components/layout/SetupGuard'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import DashboardPage from './pages/DashboardPage'
import SpecimensPage from './pages/SpecimensPage'
import SpecimenFormPage from './pages/SpecimenFormPage'
import SpecimenDetailPage from './pages/SpecimenDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import MapPage from './pages/MapPage'
import SitesPage from './pages/SitesPage'
import SpeciesPage from './pages/SpeciesPage'
import TimelinePage from './pages/TimelinePage'
import ExplorePage from './pages/ExplorePage'
import ExportPage from './pages/ExportPage'
import AdminPage from './pages/AdminPage'
import BulkImportPage from './pages/BulkImportPage'
import FindSpecimenPage from './pages/FindSpecimenPage'
import HelpPage from './pages/HelpPage'

function App() {
  return (
    <AuthProvider>
      <SetupGuard>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="specimens" element={<SpecimensPage />} />
          <Route path="specimens/new" element={<SpecimenFormPage />} />
          <Route path="specimens/find" element={<FindSpecimenPage />} />
          <Route path="specimens/:id" element={<SpecimenDetailPage />} />
          <Route path="specimens/:id/edit" element={<SpecimenFormPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="map" element={<Navigate to="/explore" replace />} />
          <Route path="timeline" element={<Navigate to="/explore" replace />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="species" element={<SpeciesPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route
            path="import"
            element={
              <AdminRoute>
                <BulkImportPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
      </SetupGuard>
    </AuthProvider>
  )
}

export default App
