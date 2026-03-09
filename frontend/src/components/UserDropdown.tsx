import { LogOut, User, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';
import { getUserInfo } from '@/api';

export default function UserDropdown() {
  const navigate = useNavigate();
  const { userInfo, clearUserInfo, setUserInfo } = useUserStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiresTime');
    localStorage.removeItem('userId');
    clearUserInfo();
    navigate('/');
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    let timer: number | undefined;
    const fetchInfo = async () => {
      const res = await getUserInfo();
      if (res.success && res.data) {
        setUserInfo(res.data);
      }
    };
    fetchInfo();
    timer = window.setInterval(fetchInfo, 10000);
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [setUserInfo]);

  return (
    <div className="relative ml-2">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        {userInfo?.avatar ? (
          <img src={userInfo.avatar} alt={userInfo.nickname} className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
            <User className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </div>
        )}
        <div className="flex flex-col items-start mr-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 max-w-[100px] truncate">
                {userInfo?.nickname || '用户'}
            </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
      </button>

      {showUserMenu && (
        <>
            <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)} 
            />
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 py-1 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{userInfo?.nickname || '用户'}</p>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{userInfo?.mobile || ''}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    退出登录
                </button>
            </div>
        </>
      )}
    </div>
  );
}
