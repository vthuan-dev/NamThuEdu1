import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";

interface MindMapEditorProps {
  centralTopic: string;
  ideas: [string, string, string, string]; // [top, right, bottom, left]
  onCentralTopicChange: (value: string) => void;
  onIdeaChange: (index: number, value: string) => void;
  mainTopicForAi?: string;
  onGenerateFromTopic?: () => void;
  isGenerating?: boolean;
}

export const MindMapEditor = ({
  centralTopic,
  ideas,
  onCentralTopicChange,
  onIdeaChange,
  mainTopicForAi = "",
  onGenerateFromTopic,
  isGenerating = false,
}: MindMapEditorProps) => {
  return (
    <div className="relative w-full min-h-[380px] flex items-center justify-center py-8 px-6">
      {/* SVG Arrows Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <marker
            id="arrowhead-purple"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#a855f7" />
          </marker>
        </defs>
        
        {/* Top Arrow */}
        <line
          x1="50%"
          y1="50%"
          x2="50%"
          y2="15%"
          stroke="#a855f7"
          strokeWidth="2"
          markerEnd="url(#arrowhead-purple)"
        />
        
        {/* Right Arrow */}
        <line
          x1="50%"
          y1="50%"
          x2="85%"
          y2="50%"
          stroke="#a855f7"
          strokeWidth="2"
          markerEnd="url(#arrowhead-purple)"
        />
        
        {/* Bottom Arrow */}
        <line
          x1="50%"
          y1="50%"
          x2="50%"
          y2="85%"
          stroke="#a855f7"
          strokeWidth="2"
          markerEnd="url(#arrowhead-purple)"
        />
        
        {/* Left Arrow */}
        <line
          x1="50%"
          y1="50%"
          x2="15%"
          y2="50%"
          stroke="#a855f7"
          strokeWidth="2"
          markerEnd="url(#arrowhead-purple)"
        />
      </svg>

      {/* Top Idea */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40" style={{ zIndex: 10 }}>
        <div className="relative group">
          <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-purple-200 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={ideas[0]}
            onChange={(e) => onIdeaChange(0, e.target.value)}
            placeholder="Top idea..."
            className="relative w-full px-3 py-3 text-sm text-center border-2 border-purple-200 bg-purple-50 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-800 font-medium placeholder:text-purple-300 transition-all"
          />
          {ideas[0] && (
            <button
              onClick={() => onIdeaChange(0, "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center - Central Topic with AI Generate Button */}
      <div className="relative z-20 flex flex-col items-center gap-2">
        <div className="relative group w-56">
          <div className="absolute -top-2 -left-2 -right-2 -bottom-2 bg-purple-300 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={centralTopic}
            onChange={(e) => onCentralTopicChange(e.target.value)}
            placeholder="Central Idea (2-4 từ)..."
            className="relative w-full px-4 py-3 text-center border-3 border-purple-500 bg-white rounded-2xl focus:ring-4 focus:ring-purple-400/50 focus:border-purple-600 text-gray-900 font-bold placeholder:text-purple-300 transition-all shadow-lg text-sm"
          />
          {centralTopic && (
            <button
              onClick={() => onCentralTopicChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* AI Generate Button - appears when main topic or central topic is filled */}
        {(mainTopicForAi.trim() || centralTopic.trim()) && onGenerateFromTopic && (
          <button
            onClick={onGenerateFromTopic}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            title="AI Generate ideas and questions based on this topic"
          >
            <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? "Generating..." : "AI Generate"}
          </button>
        )}
      </div>

      {/* Right Idea */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-40" style={{ zIndex: 10 }}>
        <div className="relative group">
          <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-purple-200 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={ideas[1]}
            onChange={(e) => onIdeaChange(1, e.target.value)}
            placeholder="Right idea..."
            className="relative w-full px-3 py-3 text-sm text-center border-2 border-purple-200 bg-purple-50 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-800 font-medium placeholder:text-purple-300 transition-all"
          />
          {ideas[1] && (
            <button
              onClick={() => onIdeaChange(1, "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Idea */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40" style={{ zIndex: 10 }}>
        <div className="relative group">
          <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-purple-200 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={ideas[2]}
            onChange={(e) => onIdeaChange(2, e.target.value)}
            placeholder="Bottom idea..."
            className="relative w-full px-3 py-3 text-sm text-center border-2 border-purple-200 bg-purple-50 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-800 font-medium placeholder:text-purple-300 transition-all"
          />
          {ideas[2] && (
            <button
              onClick={() => onIdeaChange(2, "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Left Idea */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-40" style={{ zIndex: 10 }}>
        <div className="relative group">
          <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-purple-200 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <input
            type="text"
            value={ideas[3]}
            onChange={(e) => onIdeaChange(3, e.target.value)}
            placeholder="Left idea..."
            className="relative w-full px-3 py-3 text-sm text-center border-2 border-purple-200 bg-purple-50 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-gray-800 font-medium placeholder:text-purple-300 transition-all"
          />
          {ideas[3] && (
            <button
              onClick={() => onIdeaChange(3, "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Direction Hints (optional, can be removed) */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-purple-400 opacity-50 pointer-events-none">
        <ArrowUp className="w-3 h-3 mx-auto" />
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-purple-400 opacity-50 pointer-events-none">
        <ArrowRight className="w-3 h-3" />
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-purple-400 opacity-50 pointer-events-none">
        <ArrowDown className="w-3 h-3 mx-auto" />
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-purple-400 opacity-50 pointer-events-none">
        <ArrowLeft className="w-3 h-3" />
      </div>
    </div>
  );
};
