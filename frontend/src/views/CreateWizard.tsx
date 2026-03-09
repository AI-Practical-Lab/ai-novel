import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Wand2, Info, Eye, EyeOff } from 'lucide-react';
import Step1BasicInfo from '@/components/wizard/Step1BasicInfo';
import Step2GenreStyle from '@/components/wizard/Step2GenreStyle';
import Step3CoreSettings from '@/components/wizard/Step3CoreSettings';
import Step4Outline from '@/components/wizard/Step4Outline';
import { createNovel, createLore, updateLore } from '@/api';

export type WizardData = {
  title: string;
  description: string;
  genre: string;
  style: string;
  tags: string[];
  coreSettings: {
    protagonist: {
      name: string;
      gender: string;
      age: string;
      personality: string;
      cheat: string;
    };
    antagonist: {
      name: string;
      role: string;
      personality: string;
    };
    world: {
      background: string;
      powerSystem: string;
      forces: string;
    };
    outline: {
      mainConflict: string;
      summary?: string;
      volumes?: Array<{ title: string; summary: string }>;
    };
  };
};

const INITIAL_DATA: WizardData = {
  title: '',
  description: '',
  genre: '',
  style: '',
  tags: [],
  coreSettings: {
    protagonist: { name: '', gender: '', age: '', personality: '', cheat: '' },
    antagonist: { name: '', role: '', personality: '' },
    world: { background: '', powerSystem: '', forces: '' },
    outline: { mainConflict: '' }
  },
};

export default function CreateWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [inspiration, setInspiration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guideHidden, setGuideHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('createWizardGuideHidden') === '1';
    } catch {
      return false;
    }
  });

  const updateData = (partial: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await createNovel(data);
      if (res.success && res.data) {
        const nid = res.data.id;
        const outline = data.coreSettings?.outline || {};
        try {
          const createRes = await createLore(nid, '主大纲', 'outline');
          if (createRes.success && createRes.data) {
            const payload: any = { isPrimary: true };
            if (outline.summary) payload.summary = outline.summary;
            if (Array.isArray(outline.volumes)) payload.volumes = outline.volumes;
            await updateLore(nid, createRes.data[0]?.id, payload);
          }
        } catch {}
        // Navigate to the editor for the new novel
        navigate(`/editor/${nid}`);
      }
    } catch (error) {
      console.error(error);
      alert('创建失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">创建新小说</h1>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <span>第 {step} 步</span>
              <span className="text-zinc-300">/</span>
              <span>共 4 步</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-zinc-100 dark:bg-zinc-800">
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-2xl">
          {!guideHidden ? (
            <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">使用指引 · 当前第 {step} 步</span>
                </div>
                <button
                  onClick={() => {
                    setGuideHidden(true);
                    try { localStorage.setItem('createWizardGuideHidden', '1'); } catch {}
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  隐藏指引
                </button>
              </div>
              <div className="px-4 pb-4">
                {step === 1 && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">Step 1：基础信息</div>
                      <div className="mt-1 text-zinc-700 dark:text-zinc-300">操作步骤</div>
                      <ol className="list-decimal pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>填写标题、简介/灵感等基础信息。</li>
                        <li>如需灵感：点击【随机灵感】或【生成创意】，等待生成后可手动微调。</li>
                        <li>点击【下一步】。</li>
                      </ol>
                    </div>
                    <div>
                      <div className="text-zinc-700 dark:text-zinc-300">注意事项</div>
                      <ul className="list-disc pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>标题尽量不要留空；后续生成会以标题作为语义锚点。</li>
                      </ul>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">Step 2：题材与风格</div>
                      <div className="mt-1 text-zinc-700 dark:text-zinc-300">操作步骤</div>
                      <ol className="list-decimal pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>选择类型（如奇幻/科幻/悬疑等）与风格（偏克制/热血/轻松等）。</li>
                        <li>点击【下一步】。</li>
                      </ol>
                    </div>
                    <div>
                      <div className="text-zinc-700 dark:text-zinc-300">注意事项</div>
                      <ul className="list-disc pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>拿不准就选贴近的风格；后续还能在设定/总纲中微调。</li>
                      </ul>
                    </div>
                  </div>
                )}
                {step === 3 && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">Step 3：核心设定（强烈建议认真填写）</div>
                      <div className="mt-1 text-zinc-700 dark:text-zinc-300">操作步骤</div>
                      <ol className="list-decimal pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>填写世界观规则、主线矛盾、主角目标、限制条件（能力上限/代价/阵营关系）。</li>
                        <li>点击【下一步】。</li>
                      </ol>
                    </div>
                    <div>
                      <div className="text-zinc-700 dark:text-zinc-300">注意事项</div>
                      <ul className="list-disc pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>写出“详细具体的内容”（而非抽象形容词）能显著提升后续 AI 稳定性。</li>
                      </ul>
                    </div>
                  </div>
                )}
                {step === 4 && (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">Step 4：总纲/大纲</div>
                      <div className="mt-1 text-zinc-700 dark:text-zinc-300">操作步骤</div>
                      <ol className="list-decimal pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>点击【AI 重新生成总纲】可产出整体结构。</li>
                        <li>人工检查主线/人物动机/节奏是否基本合理。</li>
                        <li>点击【完成创建】。</li>
                      </ol>
                    </div>
                    <div>
                      <div className="text-zinc-700 dark:text-zinc-300">注意事项</div>
                      <ul className="list-disc pl-5 mt-1 text-zinc-700 dark:text-zinc-300">
                        <li>总纲不必一开始完美；先完成后续流程，再逐级细化与修正。</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center justify-center">
              <button
                onClick={() => {
                  setGuideHidden(false);
                  try { localStorage.setItem('createWizardGuideHidden', '0'); } catch {}
                }}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                显示指引
              </button>
            </div>
          )}
        </div>
        <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-140px)]">
          <div className="flex-1 overflow-y-auto">
            {step === 1 && (
              <Step1BasicInfo 
                data={data} 
                updateData={updateData} 
                onNext={handleNext}
                inspiration={inspiration}
                setInspiration={setInspiration}
              />
            )}
            {step === 2 && <Step2GenreStyle data={data} updateData={updateData} onNext={handleNext} onBack={handleBack} />}
            {step === 3 && <Step3CoreSettings data={data} updateData={updateData} onNext={handleNext} onBack={handleBack} />}
            {step === 4 && <Step4Outline data={data} updateData={updateData} onSubmit={handleSubmit} onBack={handleBack} isSubmitting={isSubmitting} />}
          </div>
        </div>
      </main>
    </div>
  );
}
