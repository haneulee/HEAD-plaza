"use client";

import { useState } from "react";

interface InfoPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InfoPopup({ isOpen, onClose }: InfoPopupProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 flex items-center justify-center">
        <div className="relative bg-gray-900 rounded-lg max-w-4xl w-full p-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <span className="text-2xl">×</span>
          </button>

          <h2 className="text-3xl font-bold text-white mb-6">Action! 🎬</h2>

          <div className="prose prose-invert max-w-none">
            <p className="text-lg mb-6">
              'Action!' is an interactive installation that immerses visitor in
              cinematic camera techniques. Located at Plaza Cinema, the setup
              features four model worlds, each showcasing a different technique:
              Dolly Zoom, Mirror Shot, Arc Shot, and Zero-Gravity Shot.
            </p>
            <p className="text-lg mb-6">
              Visitors can select a cinematic technique and click the 'Action!'
              button on the camera screen and move the camera on a guided track
              to replicate the movement. A dual-screen setup displays a classic
              movie scene alongside the visitor's real-time recording, allowing
              direct comparison.
            </p>
            <p className="text-lg mb-6">
              They can record, download, and share their footage. Designed for
              accessibility, the installation fosters engagement with cinema
              through hands-on exploration.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-black bg-opacity-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">Features</h3>
                <ul className="list-disc list-inside text-gray-300">
                  <li>
                    4 unique camera techniques{" "}
                    <span className="text-3xl">🎬</span>
                  </li>
                  <li>
                    Real-time recording and comparison{" "}
                    <span className="text-3xl">🎥</span>
                  </li>
                  <li>
                    Guided smartphone mounting system{" "}
                    <span className="text-3xl">🤳</span>
                  </li>
                  <li>
                    Classic movie scene references{" "}
                    <span className="text-3xl">🎞️</span>
                  </li>
                </ul>
              </div>

              <div className="bg-black bg-opacity-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3">
                  HEAD Media Design
                </h3>
                <div className="text-sm">
                  <div className="mb-3">
                    <p className="font-medium text-gray-300">Created by</p>
                    <p className="text-xs text-gray-400">
                      Haneul Farmanfarmaian & Liuliu Zhou
                    </p>
                  </div>

                  <div className="mb-3">
                    <p className="font-medium text-gray-300">Professors</p>
                    <p className="text-xs text-gray-400">
                      Matteo Loglio (oio studio) & Tibor Udvari & Pablo Bellon
                    </p>
                  </div>

                  <div className="mb-3">
                    <p className="font-medium text-gray-300">
                      In collaboration with
                    </p>
                    <p className="text-xs text-gray-400">Fondation Plaza</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
