'use client';

import { useEffect } from 'react';

export function WebMcpProvider() {
  useEffect(() => {
    // Cek apakah browser/agen mendukung WebMCP (navigator.modelContext)
    const nav = navigator as Navigator & {
      modelContext?: {
        registerTool: (tool: {
          name: string;
          description: string;
          inputSchema: Record<string, unknown>;
          execute: (args: Record<string, unknown>) => Promise<unknown>;
        }) => void;
      };
    };

    if (!nav.modelContext) return;

    try {
      nav.modelContext.registerTool({
        name: 'get_game_info',
        description:
          'Mendapatkan informasi cara bermain dan aturan dasar game Sambung Suku Kata.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          return {
            game: 'Sambung Suku Kata',
            rules:
              'Pemain menyambung suku kata terakhir dari kata sebelumnya secara bergantian dalam satu room multiplayer.',
            actions: ['Buat Room baru', 'Gabung Room menggunakan kode'],
          };
        },
      });
    } catch {
      // Abaikan jika tool sudah terdaftar atau browser membatasi akses
    }
  }, []);

  return null;
}