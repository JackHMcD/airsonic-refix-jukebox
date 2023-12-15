import IcecastMetadataStats from 'icecast-metadata-stats'

import { API } from '@/shared/api'

export class AudioController {
  api: API | null = null

  private audio = new Audio()
  private buffer = new Audio()
  private statsListener : any = null

  ontimeupdate: (value: number) => void = () => { /* do nothing */ }
  ondurationchange: (value: number) => void = () => { /* do nothing */ }
  onpause: () => void = () => { /* do nothing */ }
  onstreamtitlechange: (value: string | null) => void = () => { /* do nothing */ }
  onended: () => void = () => { /* do nothing */ }
  onerror: (err: MediaError | null) => void = () => { /* do nothing */ }

  currentTime() {
    return this.audio.currentTime
  }

  duration() {
    return this.audio.duration
  }

  setBuffer(url: string) {
    this.buffer.src = url
  }

  setVolume(value: number) {
    this.audio.volume = value
  }

  setPlaybackRate(value: number) {
    this.audio.playbackRate = value
  }

  async pause() {
    await this.api!.jukeboxStop()
  }

  async resume() {
    await this.api!.jukeboxStart()
  }

  async seek(value: number) {
    // TODO
    this.audio.volume = 0.0
    this.audio.currentTime = value
  }

  async changeTrack(options: { id: string, paused?: boolean, playbackRate?: number }) {
    this.statsListener?.stop()
    if (options.paused !== true) {
      try {
        await this.api!.jukeboxAdd([options.id])
        await this.api!.jukeboxSkip(0, 0)
        await this.api!.jukeboxStart()
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(error)
          return
        }
        throw error
      }
    }
  }
}
