import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }


  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MOCS Workstation uncaught React error boundary triggered:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 h-full w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] text-center select-none">
          <div className="w-10 h-10 rounded-[6px] bg-[#FEE2E2] flex items-center justify-center mb-3 text-[#C42B1C]">
            <AlertOctagon className="w-5 h-5 stroke-[2]" />
          </div>
          <h2 className="text-sm font-semibold text-[#1C1C1C] mb-1">
            {this.props.fallbackTitle || 'Workstation Component Error'}
          </h2>
          <p className="text-xs text-[#64748B] max-w-md mb-4 leading-relaxed font-sans">
            {this.state.error?.message || 'An unexpected rendering error interrupted scientific calculation state.'}
          </p>

          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#005FB8] hover:bg-[#004C99] text-white text-xs font-semibold tracking-wide transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Component State</span>
          </button>

          {this.state.errorInfo?.componentStack && (
            <details className="mt-4 text-left w-full max-w-lg">
              <summary className="text-[10.5px] text-[#64748B] hover:text-[#1C1C1C] cursor-pointer font-mono select-none">
                Inspect Component Stack
              </summary>
              <pre className="mt-2 p-2.5 rounded-[4px] bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#334155] font-mono overflow-x-auto whitespace-prew-wrap leading-tight max-h-40">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
