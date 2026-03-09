import { Plus, BookOpen, Clock, MoreVertical, Trash2, Upload, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getNovels, deleteNovel, updateNovel, type Novel } from '@/api';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ImportNovelModal from '@/components/ImportNovelModal';
import { useNavigate } from 'react-router-dom';

export default function Home() {

  const navigate = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{id: string, title: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNovel, setEditingNovel] = useState<{id: string, title: string, description: string} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchNovels = async () => {
    try {
      const res = await getNovels();
      if (res.success && res.data) {
        setNovels(res.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNovels();
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete({ id, title });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    
    setIsDeleting(true);
    try {
      const res = await deleteNovel(projectToDelete.id);
      if (res.success) {
        // Refresh the list
        await fetchNovels();
        setIsDeleteModalOpen(false);
        setProjectToDelete(null);
      } else {
        alert('删除失败，请重试'); // Fallback alert for error is acceptable or toast
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImportClick = () => {
    setIsImportModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, novel: Novel) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingNovel({
      id: novel.id,
      title: novel.title,
      description: novel.description || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNovel) return;
    
    setIsSaving(true);
    try {
      const res = await updateNovel(editingNovel.id, {
        title: editingNovel.title,
        description: editingNovel.description
      });
      
      if (res.success && res.data) {
        await fetchNovels();
        setIsEditModalOpen(false);
        setEditingNovel(null);
      } else {
        alert('保存失败: ' + (res.error || '未知错误'));
      }
    } catch (error) {
      console.error('Update failed:', error);
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">我的书架</h1>
            <p className="text-zinc-500 mt-2">管理你的所有小说创作项目</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleImportClick}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors font-medium shadow-sm"
            >
              <Upload className="w-5 h-5" />
              <span>导入小说</span>
            </button>
            <Link 
              to="/create"
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-opacity font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>新建小说</span>
            </Link>

          </div>
        </div>

        {/* Project Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : novels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {novels.map((novel) => (
              <div 
                key={novel.id}
                className="group relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all"
              >
                {/* Main Link Overlay */}
                <Link 
                  to={`/editor/${novel.id}`}
                  className="absolute inset-0 z-10 rounded-2xl"
                  aria-label={`打开 ${novel.title}`}
                />

                {/* Content */}
                <div className="relative flex justify-between items-start mb-4 pointer-events-none">
                  <div className="w-12 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  {/* Actions - Lifted above the link */}
                  <div className="flex gap-1 pointer-events-auto relative z-20">
                    <button 
                      onClick={(e) => handleEditClick(e, novel)}
                      className="p-2 -mt-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="编辑信息"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteClick(e, novel.id, novel.title)}
                      className="p-2 -mr-2 -mt-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="删除小说"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="relative pointer-events-none z-0">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-1">{novel.title}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-6 flex-1 min-h-[2.5rem]">
                    {novel.description || '暂无简介'}
                  </p>
                </div>
                
                <div className="relative pointer-events-none z-0 mt-auto flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(novel.updateTime).toLocaleDateString()}</span>
                  </div>
                  <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full text-zinc-500 dark:text-zinc-400">
                    {novel.genre || '未分类'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">暂无小说项目</h3>
            <p className="text-zinc-500 mt-2 mb-6">开始你的第一次创作之旅吧</p>
            <Link 
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-opacity font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>新建小说</span>
            </Link>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingNovel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">编辑小说信息</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    书名
                  </label>
                  <input
                    type="text"
                    value={editingNovel.title}
                    onChange={e => setEditingNovel(prev => prev ? {...prev, title: e.target.value} : null)}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    简介
                  </label>
                  <textarea
                    value={editingNovel.description}
                    onChange={e => setEditingNovel(prev => prev ? {...prev, description: e.target.value} : null)}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 outline-none transition-all h-32 resize-none"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <Clock className="w-4 h-4 animate-spin" />}
                  <span>保存修改</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 签到功能已移除 */}

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="删除确认"
        message={`确定要删除小说《${projectToDelete?.title}》吗？此操作不可恢复，所有章节和设定都将丢失。`}
        confirmText="彻底删除"
        isLoading={isDeleting}
      />

      <ImportNovelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
            fetchNovels();
            // Optional: redirect happens in the modal
        }}
      />
    </div>
  );
}
