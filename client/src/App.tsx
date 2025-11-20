import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AnalysisReport from "./pages/AnalysisReport";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import AnalysisResult from "./pages/AnalysisResult";
import ApiKeySettings from "./pages/ApiKeySettings";
import SarcasmCorpusManager from "./pages/SarcasmCorpusManager";
import ExecutionLogs from "./pages/ExecutionLogs";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/analysis/:id/report"} component={AnalysisReport} />
      <Route path={"/project/:id"} component={ProjectDetail} />
      <Route path={"/analysis/:sessionId/logs"} component={ExecutionLogs} />
      <Route path={"/analysis/:id"} component={AnalysisResult} />
      <Route path={"/settings/api-keys"} component={ApiKeySettings} />
      <Route path={"/settings/sarcasm-corpus"} component={SarcasmCorpusManager} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Handle OAuth token from URL parameter
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Store token in localStorage
      localStorage.setItem('auth_token', token);

      // Remove token from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());

      // Reload to apply authentication
      window.location.reload();
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
