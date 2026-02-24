import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AdminRoute from './components/layout/AdminRoute'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
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
import ExportPage from './pages/ExportPage'
import AdminPage from './pages/AdminPage'

function App() {
  return (
    <AuthProvider>
      <Routes>
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
          <Route path="specimens/:id" element={<SpecimenDetailPage />} />
          <Route path="specimens/:id/edit" element={<SpecimenFormPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="species" element={<SpeciesPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="export" element={<ExportPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
