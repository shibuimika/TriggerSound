import { useState, useRef, useEffect } from 'react'
import './App.css'

// 型定義
type TriggerWord = {
  word: string;
  title: string;
  youtubeId: string;
  startSeconds?: number;
};

// iOS判定
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// 事前登録ワードとYouTube動画情報のリスト
const TRIGGER_WORDS: TriggerWord[] = [
  { word: '乾杯', title: 'ファンファーレ', youtubeId: 'dQw4w9WgXcQ' },
  { word: 'おめでとう', title: 'お祝いソング', youtubeId: '3JZ_D3ELwOQ' },
  { word: 'ごめんなさい', title: '女々しくて', youtubeId: 'BC9P3DSZu0A', startSeconds: 27 },
  { word: '異端', title: '怪獣', youtubeId: 'a8dgNdJVluc', startSeconds: 9 },
  { word: '地動説', title: '怪獣', youtubeId: 'a8dgNdJVluc', startSeconds: 9 },
  { word: '好きです', title: 'ラブ・ストーリーは突然に', youtubeId: 'LDe0rbDromY', startSeconds: 0 },
  { word: '悲しい', title: 'Lemon', youtubeId: 'SX_ViT4Ra7k', startSeconds: 2 },
  { word: '激アツ', title: '激アツサウンド', youtubeId: 'AnXBdZiESfo', startSeconds: 13 },
  { word: 'ありがとう', title: 'ありがとうサウンド', youtubeId: 'VZBU8LvZ91Q', startSeconds: 22 },
  { word: '例えば', title: 'カタオモイ', youtubeId: 'kxs9Su_mbpU', startSeconds: 13 },
  // 必要に応じて追加
]

const REACTION_INTERVAL = 30 * 1000 // 30秒

function App() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [detected, setDetected] = useState<TriggerWord | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [lastReacted, setLastReacted] = useState<{[word: string]: number}>({})
  const [error, setError] = useState<string>('')
  const [isManualStop, setIsManualStop] = useState(false)
  const recognitionRef = useRef<any>(null)
  const playerRef = useRef<any>(null)
  const iframeContainerRef = useRef<HTMLDivElement>(null)
  const restartTimeoutRef = useRef<number | null>(null)

  // YouTube IFrame APIのスクリプトを動的に読み込む
  useEffect(() => {
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      
      // APIの読み込み完了を待つ
      ;(window as any).onYouTubeIframeAPIReady = () => {
        // APIの読み込みが完了したらエラーをクリア
        setError('')
      }
      
      tag.onerror = () => {
        setError('YouTube APIの読み込みに失敗しました。ネットワーク接続を確認してください。')
      }
      
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
  const playYouTube = async (videoId: string, startSeconds?: number) => {
    try {
      setIsPlaying(true)
      if (playerRef.current) {
        // iOS向けに音声再生の準備
        if (isIOS()) {
          try {
            await playerRef.current.playVideo()
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (e) {
            console.warn('iOS autoplay preparation failed:', e)
          }
        }
        
        if (typeof startSeconds === 'number' && startSeconds > 0) {
          playerRef.current.loadVideoById({ videoId, startSeconds })
        } else {
          playerRef.current.loadVideoById(videoId)
        }
        playerRef.current.playVideo()
        return
      }

      // 新しいプレーヤーの初期化
      try {
        playerRef.current = new (window as any).YT.Player('yt-player', {
          height: '0',
          width: '0',
          videoId,
          playerVars: {
            ...(typeof startSeconds === 'number' && startSeconds > 0 ? { start: startSeconds } : {}),
            playsinline: 1, // iOSでインライン再生を強制
            controls: 0,    // コントロールを非表示
          },
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
              // エラー時
              if (event.data === -1) {
                console.warn('YouTube player error state detected')
              }
            },
            onError: (event: any) => {
              console.error('YouTube player error:', event)
              setError('動画の再生に失敗しました。しばらく待ってから再度お試しください。')
              setIsPlaying(false)
              setDetected(null)
            }
          },
        })
      } catch (e) {
        console.error('Failed to initialize YouTube player:', e)
        setError('プレーヤーの初期化に失敗しました。ページを再読み込みしてください。')
        setIsPlaying(false)
        setDetected(null)
      }
    } catch (error) {
      console.error('playYouTube error:', error)
      setError('動画の再生に失敗しました。画面をタップしてから再度お試しください。')
      setIsPlaying(false)
      setDetected(null)
    }
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
      setError('このブラウザは音声認識に対応していません（Safari/Chrome推奨）')
      return null
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ja-JP'
    
    // iOS Safari対応
    if (isIOS()) {
      recognition.continuous = false  // iOSではcontinuous modeが不安定
      recognition.interimResults = false  // 中間結果も無効化
    } else {
      recognition.continuous = true
      recognition.interimResults = true
    }
    
    return recognition
  }

  const startRecognition = () => {
    if (isListening) return
    setError('')
    setDetected(null)
    setIsPlaying(false)
    const recognition = getRecognition()
    if (!recognition) return
    
    recognitionRef.current = recognition
    recognition.onresult = (event: any) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) {
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
    }

    recognition.onerror = (event: any) => {
      const errorMessage = {
        'not-allowed': 'マイクの使用が許可されていません。設定から許可してください。',
        'network': 'ネットワークエラーが発生しました。接続を確認してください。',
        'no-speech': '音声が検出されませんでした。',
        'aborted': '音声認識が中断されました。',
        'default': '音声認識エラーが発生しました。'
      }
      const message = errorMessage[event.error as keyof typeof errorMessage] || errorMessage.default
      setError(message)
      
      // エラーに応じた再開ロジック
      if (['network', 'no-speech', 'aborted'].includes(event.error)) {
        handleRecognitionEnd()
      } else {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      handleRecognitionEnd()
    }

    try {
      recognition.start()
      setIsListening(true)
      setIsManualStop(false)
    } catch (e) {
      setError('音声認識の開始に失敗しました。')
      setIsListening(false)
    }
  }

  const handleRecognitionEnd = () => {
    if (isListening && !isManualStop) {
      // iOSの場合は即時再開
      if (isIOS()) {
        startRecognition()
      } else {
        // その他の場合は1秒後に再開
        if (restartTimeoutRef.current) {
          window.clearTimeout(restartTimeoutRef.current)
        }
        restartTimeoutRef.current = window.setTimeout(() => {
          startRecognition()
        }, 1000)
      }
    } else {
      setIsListening(false)
    }
  }

  const handleStart = () => {
    startRecognition()
  }

  const handleStop = () => {
    setIsManualStop(true)
    if (restartTimeoutRef.current) {
      window.clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopYouTube()
    setIsListening(false)
  }

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current)
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="p-4 sm:p-8 max-w-md mx-auto min-h-screen bg-gradient-to-br from-blue-50 to-pink-50 flex flex-col justify-center">
      <h1 className="text-2xl sm:text-3xl font-bold text-blue-500 mb-6 text-center drop-shadow">TriggerSound（仮）</h1>
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
          {error}
        </div>
      )}
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
