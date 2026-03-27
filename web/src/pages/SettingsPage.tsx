import { useState, useEffect } from 'react';
import historyService from '../services/HistoryService';

type ConfirmationStep = 'none' | 'confirmed';

export default function SettingsPage() {
  const [versionCount, setVersionCount] = useState(0);
  const [storageSize, setStorageSize] = useState<string>('-');
  const [confirmationStep, setConfirmationStep] = useState<ConfirmationStep>('none');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = () => {
    const versions = historyService.getVersions();
    setVersionCount(versions.length);

    // 计算 localStorage 中游戏数据的大小
    const historyKey = 'game-version-history';
    const historyData = localStorage.getItem(historyKey);
    if (historyData) {
      const sizeInBytes = (historyKey.length + historyData.length) * 2; // UTF-16
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      setStorageSize(`${sizeInMB} MB`);
    } else {
      setStorageSize('0 MB');
    }
  };

  const handleClearData = () => {
    if (confirmationStep === 'none') {
      setConfirmationStep('confirmed');
    } else if (confirmationStep === 'confirmed') {
      // 执行删除
      setIsDeleting(true);
      try {
        historyService.clearVersions();
        loadStorageInfo();
        setConfirmationStep('none');
      } catch (error) {
        console.error('Failed to clear versions:', error);
        alert('Failed to clear data. Please try again.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleCancelConfirm = () => {
    setConfirmationStep('none');
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-[3vh] px-[4vw] pb-tabbar-safe overflow-y-auto">
      <div className="w-full max-w-[60vw] max-h-[60vh] overflow-hidden">
        {/* Data Management Section */}
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-[2vw] mb-[0.5vw]">
          {/* Storage Usage */}
          <div className="mb-[1vw] p-[1.5vw] bg-black/30 rounded-xl">
            <div className="flex items-center justify-between mb-[1vw]">
              <span className="text-gray-400 text-[clamp(0.75rem,1.5vw,0.875rem)]">Storage Usage</span>
              <span className="text-white text-[clamp(0.75rem,1.5vw,0.875rem)] font-semibold">{storageSize}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                style={{
                  width: storageSize === '-' ? '0%' : `${Math.min(parseFloat(storageSize) / 5 * 100, 100)}%`
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-[1vw]">
              <span className="text-gray-500 text-[clamp(0.625rem,1.2vw,0.75rem)]">Local Storage Limit: ~5-10 MB</span>
              <span className="text-gray-400 text-[clamp(0.625rem,1.2vw,0.75rem)]">📦 {versionCount} version{versionCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-[1vw]">
            <button
              onClick={handleClearData}
              disabled={isDeleting || versionCount === 0}
              className={`px-[1.5vw] py-[1vw] rounded-lg text-[clamp(0.75rem,1.5vw,0.875rem)] font-semibold transition-all ${isDeleting || versionCount === 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : confirmationStep === 'confirmed'
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                    : 'bg-red-500/20 hover:bg-red-500/40 text-red-400'
                }`}
            >
              {isDeleting ? 'Deleting...' : confirmationStep === 'none' && 'Clear All Data'}
              {confirmationStep === 'confirmed' && ' Yes, Delete Everything'}
            </button>

            {confirmationStep !== 'none' && (
              <button
                onClick={handleCancelConfirm}
                className="px-[1.5vw] py-[1vw] rounded-lg text-[clamp(0.75rem,1.5vw,0.875rem)] font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
              >
                Cancel
              </button>
            )}
          </div>

          {confirmationStep === 'confirmed' && (
            <p className="text-red-400 text-[clamp(0.75rem,1.5vw,0.875rem)] mt-[1.5vw]">
              This will permanently delete all {versionCount} version{versionCount !== 1 ? 's' : ''}. Are you sure?
            </p>
          )}

        </div>

        {/* Info Section */}
        <div className="bg-gray-800/30 rounded-2xl p-[1.5vw]">
          <p className="text-gray-500 text-[clamp(0.625rem,1.2vw,0.75rem)] text-center">
            All data is stored locally in your browser. Nothing is sent to external servers.
          </p>
        </div>
      </div>
    </div>
  );
}
