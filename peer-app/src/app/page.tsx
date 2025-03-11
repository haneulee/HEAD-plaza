import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Action! 🎬</h1>

        <div className="mb-12">
          <p className="text-lg mb-6">
            'Action!' is an interactive installation that immerses visitor in
            cinematic camera techniques. Located at Plaza Cinema, the setup
            features four model worlds, each showcasing a different technique:
            Dolly Zoom, Mirror Shot, Arc Shot, and Zero-Gravity Shot.
          </p>
          <p className="text-lg mb-6">
            Visitors can select a cinematic technique and click the 'Action!'
            button on the camera screen and move the camera on a guided track to
            replicate the movement. A dual-screen setup displays a classic movie
            scene alongside the visitor's real-time recording, allowing direct
            comparison.
          </p>
          <p className="text-lg mb-6">
            They can record, download, and share their footage. Designed for
            accessibility, the installation fosters engagement with cinema
            through hands-on exploration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Link href="/dolly-zoom" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Dolly Zoom
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Experience the famous "Vertigo effect" with our interactive
                dolly zoom setup.
              </p>
            </div>
          </Link>

          {/* <Link href="/mirror-shot" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Mirror Shot
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Create mesmerizing mirror effects with synchronized camera
                movements.
              </p>
            </div>
          </Link> */}

          <Link href="/arc-shot" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Arc Shot
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Circle around your subject with our guided arc shot system.
              </p>
            </div>
          </Link>

          <Link href="/zero-gravity" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Zero-Gravity Shot
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Simulate weightlessness with our zero-gravity camera technique.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
