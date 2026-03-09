import { AlertCircle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'danger',
  isLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      bgIcon: 'bg-red-50 dark:bg-red-900/20'
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      bgIcon: 'bg-yellow-50 dark:bg-yellow-900/20'
    },
    info: {
      icon: 'text-blue-500',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      bgIcon: 'bg-blue-50 dark:bg-blue-900/20'
    }
  };

  const style = colors[variant];

  return (
    <div className="absolute inset-0 z-[60] bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex flex-col items-center text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${style.bgIcon}`}>
                <AlertCircle className={`w-6 h-6 ${style.icon}`} />
            </div>
            
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {title}
            </h3>
            
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                {message}
            </p>
            
            <div className="flex w-full gap-3">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {cancelText}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onConfirm();
                        onClose();
                    }}
                    disabled={isLoading}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${style.button}`}
                >
                    {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {confirmText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
