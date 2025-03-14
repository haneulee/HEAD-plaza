import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Action! 🎬</h1>

        <div className="mb-12">
          <p className="text-lg mb-6">
            ‘Action!’ is an interactive installation that immerses visitors in a
            hands-on experience of camera movements in cinema. The setup
            features multiple behind-the-scene filming studios, each showcasing
            a cinematic technique such as Dolly Zoom, Arc Shot, Zero-Gravity
            Shot and Mirror Shot.
          </p>
          <p className="text-lg mb-6">
            Cameras in filmmaking are more than just recording devices— they are
            storytelling tools that shape what audiences focus on. This
            installation allows audiences to step into the role of the cameraman
            by exploring classic movie clips demonstrating each technique. By
            physically playing with the camera, they can simu- late professional
            cinematographic effects. Their real-time footage is displayed
            alongside the original movie clip, offering a direct visual
            comparison and a deeper understanding of the techniques.
          </p>
          <p className="text-lg mb-6">
            As an engaging and educational experience, ‘Action!’ makes the
            production part of cinema accessible to a general audience. Au-
            diences not only gain insight into the technical aspects of filmma-
            king but also leave with their own recorded movie clips, allowing
            them to share their creations and continue the conversation beyond
            the exhibition space.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Link href="/dolly-simple" className="group">
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

          <Link href="/arc-simple" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Arc Shot
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Circle around your subject with our guided arc shot system.
              </p>
            </div>
          </Link>

          {/* <Link href="/zero-gravity" className="group">
            <div className="border border-gray-700 rounded-lg p-6 hover:border-white transition-colors">
              <h2 className="text-2xl font-semibold mb-4 group-hover:text-yellow-400">
                Zero-Gravity Shot
              </h2>
              <p className="text-gray-400 group-hover:text-white">
                Simulate weightlessness with our zero-gravity camera technique.
              </p>
            </div>
          </Link> */}
        </div>
      </div>
    </main>
  );
}
