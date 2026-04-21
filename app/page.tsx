import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-amber-400 mb-2">
        KitchenQ
      </h1>
      <p className="text-gray-400 mb-8 text-lg">
        厨房管理システム KitchenQ
      </p>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/kitchen"
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 px-8 rounded-xl text-center text-xl transition-colors"
        >
          厨房画面を開く
        </Link>
        <Link
          href="/orders"
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-xl text-center text-xl transition-colors"
        >
          注文管理
        </Link>
        <Link
          href="/analytics"
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-xl text-center text-xl transition-colors"
        >
          分析レポート
        </Link>
      </div>
    </main>
  )
}