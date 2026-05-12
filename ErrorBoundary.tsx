import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#080A12] px-8 text-center text-white mesh-bg-vibrant relative overflow-hidden">
          <div className="relative z-10 p-8 glass-card max-w-md w-full">
            <h1 className="text-3xl font-black mb-4 tracking-tight">Something went wrong.</h1>
            <p className="text-white/70 mb-8 text-sm">
              We're sorry, an unexpected error occurred. Please try reloading the application.
            </p>
            <div className="bg-black/40 p-4 rounded-xl text-left overflow-auto max-h-48 mb-8">
              <pre className="text-red-400 text-xs font-mono whitespace-pre-wrap">
                {this.state.error?.toString()}
              </pre>
            </div>
            <button
              className="px-8 py-4 bg-white text-[#080A12] rounded-full font-black text-sm tracking-widest uppercase shadow-xl active:scale-95 transition-all"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
