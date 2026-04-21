import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-amber-400 mb-4">
        蜴ｨ謌ｿ蜿ｸ莉､蝪・PRO
      </h1>
      <p className="text-gray-400 mb-8 text-lg">
        蜴ｨ謌ｿ繧ｪ繝ｼ繝繝ｼ譛驕ｩ蛹悶す繧ｹ繝・Β
      </p>
      <div className="flex flex-col gap-4 w-full max-w-sm">
        <Link
          href="/kitchen"
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 px-8 rounded-xl text-center text-xl transition-colors"
        >
          蜴ｨ謌ｿ逕ｻ髱｢繧帝幕縺・        </Link>
        <Link
          href="/orders"
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-8 rounded-xl text-center text-xl transition-colors"
        >
          豕ｨ譁・ｮ｡逅・        </Link>
      </div>
    </main>
  )
}
