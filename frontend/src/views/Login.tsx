import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, Sparkles } from 'lucide-react';
import { login, smsLogin, sendSmsCode, getUserInfo } from '../api';
import { useUserStore } from '../store/userStore';

const Login: React.FC = () => {
  const [loginType, setLoginType] = useState<'password' | 'sms'>('password');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendSms = async () => {
    if (!mobile) {
      setError('请输入手机号');
      return;
    }
    if (countdown > 0) return;

    setError('');
    const res = await sendSmsCode({ mobile, scene: 1 }); // 1 = MEMBER_LOGIN
    if (res.success) {
      setCountdown(60);
    } else {
      setError(res.error || '验证码发送失败');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let res;
    if (loginType === 'password') {
      res = await login({ mobile, password });
    } else {
      res = await smsLogin({ mobile, code: smsCode });
    }

    setLoading(false);

    if (res.success && res.data) {
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      localStorage.setItem('userId', res.data.userId.toString());
      localStorage.setItem('expiresTime', res.data.expiresTime);
      
      // Fetch and store user info
      try {
        const userInfoRes = await getUserInfo();
        if (userInfoRes.success && userInfoRes.data) {
          useUserStore.getState().setUserInfo(userInfoRes.data);
        }
      } catch (e) {
        console.error('Failed to fetch user info:', e);
      }

      navigate('/');
    } else {
      setError(res.error || '登录失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="hidden md:flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <BookOpen className="text-indigo-600" size={28} />
              <span className="text-2xl font-bold text-gray-900">AI小说写作助手</span>
            </div>
            <p className="text-gray-600">
              借助 AI 灵感、章节结构与角色设定，快速完成小说创作，全流程协同与版本管理，让创作更高效。
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-gray-700">
                <Sparkles className="text-indigo-600" size={18} />
                <span>智能大纲生成与情节推进</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Sparkles className="text-indigo-600" size={18} />
                <span>角色档案与世界观构建</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Sparkles className="text-indigo-600" size={18} />
                <span>版本对比与修改建议</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-100 w-full max-w-md mx-auto">
            <div className="px-8 pt-8">
              <h2 className="text-xl font-bold text-gray-900 text-center">登录你的账号</h2>
              <p className="text-center text-sm text-gray-500 mt-2">欢迎回来，继续你的创作旅程</p>
              <div className="flex mt-6 border-b">
                <button
                  className={`flex-1 pb-2 text-center transition-colors ${
                    loginType === 'password'
                      ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => { setLoginType('password'); setError(''); }}
                >
                  密码登录
                </button>
                <button
                  className={`flex-1 pb-2 text-center transition-colors ${
                    loginType === 'sms'
                      ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => { setLoginType('sms'); setError(''); }}
                >
                  验证码登录
                </button>
              </div>
              {error && <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded mt-6">{error}</div>}
              <form onSubmit={handleLogin} className="mt-6">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="mobile">
                    手机号
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    id="mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                    placeholder="请输入手机号"
                  />
                </div>
                {loginType === 'password' ? (
                  <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="password">
                      密码
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                        required
                        placeholder="请输入密码"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <label className="block text-gray-700 text-sm font-medium mb-2" htmlFor="smsCode">
                      验证码
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="smsCode"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                        placeholder="请输入验证码"
                      />
                      <button
                        type="button"
                        onClick={handleSendSms}
                        disabled={countdown > 0}
                        className={`px-4 py-2 border rounded-lg text-sm font-medium transition ${
                          countdown > 0
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-white text-indigo-600 border-indigo-600 hover:bg-indigo-50'
                        }`}
                      >
                        {countdown > 0 ? `${countdown}s后重发` : '获取验证码'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">未注册的手机号将自动完成注册</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'
                  }`}
                >
                  {loading ? '登录中...' : (loginType === 'sms' ? '登录 / 注册' : '登录')}
                </button>
                <p className="text-xs text-gray-500 mt-4 text-center">
                  登录即表示你同意平台的用户协议与隐私政策
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
