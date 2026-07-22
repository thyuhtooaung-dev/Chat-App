import React from 'react';
import { UserProfile } from '../../types/chat';

interface UserProfileModalProps {
  selectedProfileUser: UserProfile | null;
  currentUser: UserProfile | null;
  editBioText: string;
  isSavingBio: boolean;
  onClose: () => void;
  onSetEditBioText: (text: string) => void;
  onSaveBio: () => void;
  formatLastSeen: (lastSeen?: string, isOnline?: boolean) => string;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  selectedProfileUser,
  currentUser,
  editBioText,
  isSavingBio,
  onClose,
  onSetEditBioText,
  onSaveBio,
  formatLastSeen,
}) => {
  if (!selectedProfileUser) return null;

  const isSelfProfile = currentUser?.id === selectedProfileUser.id;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg cursor-pointer"
        >
          ✕
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          <div
            style={{
              backgroundColor: selectedProfileUser.avatarColor || '#3B82F6',
            }}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg mb-3"
          >
            {selectedProfileUser.username[0]?.toUpperCase()}
          </div>

          <h3 className="text-lg font-bold text-white">
            {selectedProfileUser.username}
          </h3>

          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                selectedProfileUser.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            {formatLastSeen(
              selectedProfileUser.lastSeen,
              selectedProfileUser.isOnline,
            )}
          </p>

          {selectedProfileUser.createdAt && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              Member since{' '}
              {new Date(selectedProfileUser.createdAt).toLocaleDateString()}
            </p>
          )}

          {/* Bio Section */}
          <div className="w-full mt-6 bg-slate-950/50 border border-slate-800/80 rounded-xl p-4 text-left">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Bio / Status
            </h4>

            {isSelfProfile ? (
              <div className="space-y-2">
                <textarea
                  value={editBioText}
                  onChange={(e) => onSetEditBioText(e.target.value)}
                  placeholder="Write something about yourself..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={onSaveBio}
                  disabled={isSavingBio}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
                >
                  {isSavingBio ? 'Saving...' : 'Save Bio'}
                </button>
              </div>
            ) : (
              <p className="text-slate-300 italic text-xs">
                {selectedProfileUser.bio || 'No status set.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
