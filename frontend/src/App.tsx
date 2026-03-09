import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/views/Home";
import CreateWizard from "@/views/CreateWizard";
import ProtectedRoute from "@/components/ProtectedRoute";

const EditorLayout = lazy(() => import('@/views/EditorLayout'));

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/editor/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={<div className="p-4">加载编辑器中...</div>}>
                <EditorLayout />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/other"
          element={
            <ProtectedRoute>
              <div className="text-center text-xl">Other Page - Coming Soon</div>
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster />
    </Router>
  );
}
