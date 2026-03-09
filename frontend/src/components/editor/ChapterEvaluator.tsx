import { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  Sparkles, 
  ThumbsUp, 
  X 
} from 'lucide-react';
import { 
  evaluateChapter, 
  rewriteChapter, 
  type Chapter, 
  type ChapterEvaluation, 
  type EvaluationIssue, 
  type Foreshadowing,
  type CoreSettings
} from '@/api';

interface Props {
  chapter: Chapter;
  previousChapter?: Chapter;
  volumeSummary?: string;
  globalLore?: string;
  foreshadowing?: Foreshadowing[];
   coreSettings?: CoreSettings;
  onRewrite: (newContent: string) => void;
  onClose: () => void;
}

export default function ChapterEvaluator({
  chapter,
  previousChapter,
  volumeSummary,
  globalLore,
  foreshadowing,
  coreSettings,
  onRewrite,
  onClose
}: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [evaluation, setEvaluation] = useState<ChapterEvaluation | null>(null);
  const [activeIssues, setActiveIssues] = useState<EvaluationIssue[]>([]);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await evaluateChapter({
        chapter,
        previousChapter,
        volumeSummary,
        globalLore,
        foreshadowing
      });

      if (res.success && res.data) {
        setEvaluation(res.data);
        setActiveIssues(res.data.issues || []);
      } else {
        setError(res.error || '分析失败');
      }
    } catch (e) {
      setError('分析请求异常');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async () => {
    if (!evaluation) return;
    setIsRewriting(true);
    setError(null);
    try {
      const filteredEvaluation: ChapterEvaluation = {
        ...evaluation,
        issues: activeIssues
      };

      const res = await rewriteChapter({
        chapter,
        evaluation: filteredEvaluation,
        previousChapter,
        volumeSummary,
        globalLore,
        foreshadowing,
        instruction: rewriteInstruction,
        coreSettings
      });

      console.log('[ChapterEvaluator] Rewrite result:', res);

      if (res.success && res.data) {
        onRewrite(res.data);
      } else {
        setError(res.error || '重写失败：AI未返回有效内容');
      }
    } catch (e) {
      console.error('[ChapterEvaluator] Rewrite exception:', e);
      setError('重写请求异常');
    } finally {
      setIsRewriting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const ScoreBar = ({ label, score }: { label: string; score: number }) => (
    <div className="flex items-center gap-3 mb-2">
      <span className="w-24 text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`w-8 text-sm font-medium text-right ${getScoreColor(score)}`}>
        {score}
      </span>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-xl w-[400px]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          章节质量分析
        </h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        >
          <X className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {!evaluation && !isAnalyzing && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-purple-500" />
            </div>
            <h4 className="text-zinc-900 dark:text-zinc-100 font-medium mb-2">准备就绪</h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 px-4">
              AI 将根据网文写作原则，对本章的剧情、节奏、人设和伏笔进行深度分析。
            </p>
            <button
              onClick={handleEvaluate}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-4 h-4" />
              开始分析
            </button>
          </div>
        )}

        {isAnalyzing && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-zinc-600 dark:text-zinc-400">正在深入分析章节内容...</p>
          </div>
        )}

        {evaluation && !isAnalyzing && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-center border border-zinc-200 dark:border-zinc-800">
              <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">综合评分</div>
              <div className={`text-4xl font-bold ${getScoreColor(evaluation.overallScore)}`}>
                {evaluation.overallScore}
              </div>
            </div>

            {/* Detailed Scores */}
            <div className="space-y-1">
              <ScoreBar label="剧情结构" score={evaluation.structureScore} />
              <ScoreBar label="剧情推进" score={evaluation.plotProgressScore} />
              <ScoreBar label="人物表现" score={evaluation.characterScore} />
              <ScoreBar label="世界观" score={evaluation.worldConsistencyScore} />
              <ScoreBar label="悬念钩子" score={evaluation.hookScore} />
              <ScoreBar label="文笔风格" score={evaluation.styleScore} />
            </div>

            {/* Summary */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
              <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> 综合评价
              </h5>
              <p className="text-sm text-blue-700 dark:text-blue-200 leading-relaxed">
                {evaluation.summary}
              </p>
            </div>

            {/* Issues */}
            <div>
              <h5 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">诊断问题 ({activeIssues.length})</h5>
              <div className="space-y-3">
                {activeIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        issue.severity === 'major' 
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : issue.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {issue.severity === 'major' ? '严重' : issue.severity === 'medium' ? '中等' : '轻微'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 uppercase tracking-wider">{issue.category}</span>
                        <button
                          onClick={() => {
                            setActiveIssues(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          删除本条建议
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium mb-2">{issue.description}</p>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded">
                      <span className="font-medium text-purple-600 dark:text-purple-400">建议：</span>
                      {issue.suggestion}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rewrite Action */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <h5 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                AI 深度优化
              </h5>
              <textarea
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                placeholder="可以在这里输入额外的修改指令，例如：'加强动作描写'、'让主角更果断一点'..."
                className="w-full h-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
              />
              <button
                onClick={handleRewrite}
                disabled={isRewriting}
                className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在重写中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    根据分析结果重写本章
                  </>
                )}
              </button>
              <p className="text-xs text-center text-zinc-500 mt-2">
                重写后将进入对比模式，由您决定是否采纳。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
