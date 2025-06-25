import { useState, useRef, useEffect } from 'react'
import './App.css'

// 型定義
type TriggerWord = {
  word: string;
  title: string;
  youtubeId: string;
  startSeconds?: number;
};

// 事前登録ワードとYouTube動画情報のリスト
const TRIGGER_WORDS: TriggerWord[] = [
  { word: '乾杯', title: 'ファンファーレ', youtubeId: 'dQw4w9WgXcQ' },
  { word: 'おめでとう', title: 'お祝いソング', youtubeId: '3JZ_D3ELwOQ' },
  { word: 'ごめんなさい', title: '女々しくて', youtubeId: 'BC9P3DSZu0A', startSeconds: 27 },
  { word: '異端', title: '怪獣', youtubeId: 'a8dgNdJVluc', startSeconds: 9 },
  { word: '地動説', title: '怪獣', youtubeId: 'a8dgNdJVluc', startSeconds: 9 },
  { word: '好きです', title: 'ラブ・ストーリーは突然に', youtubeId: 'LDe0rbDromY', startSeconds: 0 },
  // 必要に応じて追加
]

const REACTION_INTERVAL = 30 * 1000 // 30秒

function App() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [detected, setDetected] = useState<TriggerWord | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [lastReacted, setLastReacted] = useState<{[word: string]: number}>({})
  const recognitionRef = useRef<any>(null)
  const playerRef = useRef<any>(null)
  const iframeContainerRef = useRef<HTMLDivElement>(null)

  // YouTube IFrame APIのスクリプトを動的に読み込む
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  }, [])

  // 検出ワードが変わったらYouTube再生
  useEffect(() => {
    if (detected && (window as any).YT && (window as any).YT.Player) {
      playYouTube(detected.youtubeId, detected.startSeconds)
    }
    // eslint-disable-next-line
  }, [detected])

  // STOP時に動画も停止
  useEffect(() => {
    if (!isListening && isPlaying) {
      stopYouTube()
    }
    // eslint-disable-next-line
  }, [isListening])

  // visibilitychangeで音声認識の自動再開
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isListening && !recognitionRef.current) {
        // ページ復帰時に音声認識が止まっていたら再開
        handleStart()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line
  }, [isListening])

  // YouTube再生関数
  const playYouTube = (videoId: string, startSeconds?: number) => {
    setIsPlaying(true)
    if (playerRef.current) {
      if (typeof startSeconds === 'number' && startSeconds > 0) {
        playerRef.current.loadVideoById({ videoId, startSeconds })
      } else {
        playerRef.current.loadVideoById(videoId)
      }
      playerRef.current.playVideo()
      return
    }
    playerRef.current = new (window as any).YT.Player('yt-player', {
      height: '0',
      width: '0',
      videoId,
      playerVars: (typeof startSeconds === 'number' && startSeconds > 0) ? { start: startSeconds } : {},
      events: {
        onReady: (event: any) => {
          if (typeof startSeconds === 'number' && startSeconds > 0) {
            event.target.seekTo(startSeconds)
          }
          event.target.playVideo()
        },
        onStateChange: (event: any) => {
          // 動画終了時
          if (event.data === 0) {
            setIsPlaying(false)
            setDetected(null)
          }
        },
      },
    })
  }

  // YouTube停止関数
  const stopYouTube = () => {
    if (playerRef.current) {
      playerRef.current.stopVideo()
      setIsPlaying(false)
      setDetected(null)
    }
  }

  // Web Speech APIの初期化
  const getRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('このブラウザは音声認識に対応していません（Chrome推奨）')
      return null
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = true
    return recognition
  }

  const handleStart = () => {
    if (isListening) return
    setDetected(null)
    setIsPlaying(false)
    const recognition = getRecognition()
    if (!recognition) return
    recognitionRef.current = recognition
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript
      }
      setTranscript(finalTranscript)
      // 制御ルール：曲再生中は無視
      if (isPlaying) return
      // ワード検出
      const now = Date.now()
      for (const item of TRIGGER_WORDS) {
        if (finalTranscript.includes(item.word)) {
          // 30秒以内の同一ワードは無視
          if (lastReacted[item.word] && now - lastReacted[item.word] < REACTION_INTERVAL) {
            continue
          }
          setDetected(item)
          setLastReacted(prev => ({ ...prev, [item.word]: now }))
          break
        }
      }
    }
    recognition.onerror = (event: any) => {
      alert('音声認識エラー: ' + event.error)
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognition.start()
    setIsListening(true)
  }

  const handleStop = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopYouTube()
    setIsListening(false)
  }

  return (
    <div className="p-4 sm:p-8 max-w-md mx-auto min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 flex flex-col justify-center">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-500 mb-6 text-center drop-shadow">TriggerSound（仮）</h1>
      <div className="flex gap-4 mb-6 justify-center">
        <button
          className={`px-6 py-3 rounded-lg bg-green-500 text-white font-bold shadow-md focus:outline-none focus:ring-4 focus:ring-green-300 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl`}
          onClick={handleStart}
          disabled={isListening}
          aria-label="音声認識開始"
        >
          START
        </button>
        <button
          className={`px-6 py-3 rounded-lg bg-red-500 text-white font-bold shadow-md focus:outline-none focus:ring-4 focus:ring-red-300 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-xl`}
          onClick={handleStop}
          disabled={!isListening}
          aria-label="音声認識停止"
        >
          STOP
        </button>
      </div>
      <div className="mb-4 text-center">
        <span className="font-semibold">ステータス：</span>
        {isListening ? (
          <span className="text-green-600">音声認識中…</span>
        ) : (
          <span className="text-gray-500">停止中</span>
        )}
      </div>
      <div className="mb-4 text-center">
        <span className="font-semibold">検出中の言葉：</span>
        <span className="text-blue-700 break-words">{transcript || '---'}</span>
      </div>
      <div className="mb-4 text-center">
        <span className="font-semibold">検出ワード：</span>
        {detected ? (
          <span className="text-pink-600 font-bold">
            {detected.word}（{detected.title}
            {detected.startSeconds && detected.startSeconds > 0 && ` / ${detected.startSeconds}秒から`}）
          </span>
        ) : (
          <span className="text-gray-400">---</span>
        )}
      </div>
      {/* YouTube再生中UI */}
      {isPlaying && detected && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="animate-pulse text-red-500 text-xl">●</span>
          <span className="font-semibold">再生中：</span>
          <span className="text-base sm:text-lg">{detected.title}</span>
        </div>
      )}
      {/* YouTube IFrame（非表示） */}
      <div ref={iframeContainerRef} style={{ width: 0, height: 0, overflow: 'hidden' }}>
        <div id="yt-player" />
      </div>
      <footer className="mt-8 text-xs text-gray-400 text-center select-none">
        © {new Date().getFullYear()} TriggerSound
      </footer>
    </div>
  )
}

export default App
