import Vuex, { Store, Module } from 'vuex'
import { shuffle, shuffled, trackListEquals } from '@/shared/utils'
import { API, Track } from '@/shared/api'
import { useMainStore } from '@/shared/store'

localStorage.removeItem('player.mute')
const storedVolume = parseFloat(localStorage.getItem('player.volume') || '1.0')
const storedPodcastPlaybackRate = parseFloat(localStorage.getItem('player.podcastPlaybackRate') || '1.0')
const mediaSession: MediaSession | undefined = navigator.mediaSession

export class JukeboxController {
  onPlayTrackListIndex: (index: number) => Promise<void> = async() => { /* do nothing */ }
  onPlayTrackList: (tracks: Array<Track>, index: number) => Promise<void> = async() => { /* do nothing */ }
  onResume: () => Promise<void> = async() => { /* do nothing */ }
  onPause: () => Promise<void> = async() => { /* do nothing */ }
  skip: (index: number, offset: number) => Promise<void> = async() => { /* do nothing */ }
  setGain: (gain: number) => Promise<void> = async() => { /* do nothing */ }
}

const jukebox = new JukeboxController()

interface State {
  queue: any[];
  queueIndex: number;
  isPlaying: boolean;
  duration: number; // duration of current track in seconds
  currentTime: number; // position of current track in seconds
  streamTitle: string | null;
  repeat: boolean;
  shuffle: boolean;
  volume: number; // integer between 0 and 1 representing the volume of the player
  podcastPlaybackRate: number;
}

function persistQueue(state: State) {
  // do nothing
}

export const playerModule: Module<State, any> = {
  namespaced: true,
  state: {
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    streamTitle: null,
    repeat: localStorage.getItem('player.repeat') !== 'false',
    shuffle: localStorage.getItem('player.shuffle') === 'true',
    volume: storedVolume,
    podcastPlaybackRate: storedPodcastPlaybackRate,
  },

  mutations: {
    setIsPlaying(state, isPlaying) {
      state.isPlaying = isPlaying
    },
    setRepeat(state, enable) {
      state.repeat = enable
      localStorage.setItem('player.repeat', enable)
    },
    setShuffle(state, enable) {
      state.shuffle = enable
      localStorage.setItem('player.shuffle', enable)
    },
    setQueue(state, queue) {
      state.queue = queue
      state.queueIndex = -1
    },
    setQueueIndex(state, index) {
      if (state.queue.length === 0) {
        return
      }
      index = Math.max(0, index)
      index = index < state.queue.length ? index : 0
      state.queueIndex = index
      const track = state.queue[index]
      state.duration = track.duration
    },
    addToQueue(state, tracks) {
      state.queue.push(...tracks)
      persistQueue(state)
    },
    removeFromQueue(state, index) {
      state.queue.splice(index, 1)
      if (index < state.queueIndex) {
        state.queueIndex--
      }
      persistQueue(state)
    },
    clearQueue(state) {
      if (state.queueIndex >= 0) {
        state.queue = [state.queue[state.queueIndex]]
        state.queueIndex = 0
        persistQueue(state)
      }
    },
    shuffleQueue(state) {
      if (state.queue.length > 0) {
        state.queue = shuffled(state.queue, state.queueIndex)
        state.queueIndex = 0
        persistQueue(state)
      }
    },
    setNextInQueue(state, tracks) {
      state.queue.splice(state.queueIndex + 1, 0, ...tracks)
      persistQueue(state)
    },
    setCurrentTime(state, value: any) {
      state.currentTime = value
    },
    setDuration(state, value: any) {
      if (isFinite(value)) {
        state.duration = value
      }
    },
    setStreamTitle(state, value: string | null) {
      state.streamTitle = value
      if (value && mediaSession?.metadata) {
        mediaSession.metadata.title = value
      }
    },
    setVolume(state, value: number) {
      state.volume = value
      localStorage.setItem('player.volume', String(value))
    },
    setPodcastPlaybackRate(state, value) {
      state.podcastPlaybackRate = value
      localStorage.setItem('player.podcastPlaybackRate', String(value))
    }
  },

  actions: {
    async playNow({ commit, dispatch }, { tracks }) {
      commit('setShuffle', false)
      dispatch('playTrackList', { tracks, index: 0 })
    },
    async shuffleNow({ commit, dispatch }, { tracks }) {
      commit('setShuffle', true)
      dispatch('playTrackList', { tracks })
    },
    async playTrackListIndex({ commit, state, getters }, { index }) {
      commit('setQueueIndex', index)
      commit('setIsPlaying', true)

      await jukebox.onPlayTrackListIndex(index)
    },
    async playTrackList({ commit, state, getters }, { tracks, index }) {
      if (index == null) {
        index = state.shuffle ? Math.floor(Math.random() * tracks.length) : 0
      }
      if (state.shuffle) {
        tracks = [...tracks]
        shuffle(tracks, index)
        index = 0
      }
      commit('setQueue', tracks)
      commit('setQueueIndex', index)
      commit('setIsPlaying', true)

      await jukebox.onPlayTrackList(tracks, index)
    },
    async resume({ commit, state }) {
      commit('setIsPlaying', true)

      await jukebox.onResume()
    },
    async pause({ commit, state }) {
      commit('setIsPlaying', false)

      await jukebox.onPause()
    },
    async playPause({ state, dispatch }) {
      return state.isPlaying ? dispatch('pause') : dispatch('resume')
    },
    async next({ commit, state, getters }) {
      commit('setQueueIndex', state.queueIndex + 1)
      commit('setIsPlaying', true)

      await jukebox.skip(state.queueIndex + 1, 0)
    },
    async previous({ commit, state }) {
      // TODO: skip to beginning of track if it's been playing for more than 3s
      const newIndex = state.queueIndex - 1

      commit('setQueueIndex', newIndex)
      commit('setIsPlaying', true)

      await jukebox.skip(newIndex, 0)
    },
    async seek({ state }, value) {
      if (isFinite(state.duration)) {
        await jukebox.skip(state.queueIndex, Math.floor(state.duration * value))
      }
    },
    async resetQueue({ commit, state }) {
      commit('setQueueIndex', 0)
      commit('setIsPlaying', false)

      await jukebox.skip(0, 0)
      await jukebox.onPause()
    },
    toggleRepeat({ commit, state }) {
      commit('setRepeat', !state.repeat)
    },
    toggleShuffle({ commit, state }) {
      commit('setShuffle', !state.shuffle)
    },
    setShuffle({ commit }, enable: boolean) {
      commit('setShuffle', enable)
    },
    addToQueue({ state, commit }, tracks) {
      commit('addToQueue', state.shuffle ? shuffled(tracks) : tracks)
    },
    setNextInQueue({ state, commit }, tracks) {
      commit('setNextInQueue', state.shuffle ? shuffled(tracks) : tracks)
    },
    async setVolume({ state, commit }, value) {
      commit('setVolume', value)
      await jukebox.setGain(value)
    },
    setPlaybackRate({ commit, getters }, value) {
      commit('setPodcastPlaybackRate', value)
      throw new Error('not implemented')
    },
  },

  getters: {
    track(state) {
      if (state.queueIndex !== -1) {
        return state.queue[state.queueIndex]
      }
      return null
    },
    trackId(state, getters): number {
      return getters.track ? getters.track.id : -1
    },
    isPlaying(state): boolean {
      return state.isPlaying
    },
    progress(state): number {
      if (state.currentTime > -1 && state.duration > 0) {
        return state.currentTime / state.duration
      }
      return 0
    },
    hasNext(state) {
      return state.queueIndex < state.queue.length - 1
    },
    hasPrevious(state) {
      return state.queueIndex > 0
    },
    playbackRate(state, getters): number {
      return getters.track?.isPodcast ? state.podcastPlaybackRate : 1.0
    },
  },
}

export function createPlayerStore(mainStore: ReturnType<typeof useMainStore>, api: API) {
  jukebox.onPlayTrackListIndex = async(index: number) => {
    await api.jukeboxSkip(index, 0)
    await api.jukeboxStart()
  }

  jukebox.onPlayTrackList = async(tracks: Array<Track>, index: number) => {
    await api.jukeboxSet(tracks.map((tr: any) => tr.id))
    await api.jukeboxSkip(index, 0)
    await api.jukeboxStart()
  }

  jukebox.onResume = async() => {
    await api.jukeboxStart()
  }

  jukebox.onPause = async() => {
    await api.jukeboxStop()
  }

  jukebox.skip = async(index: number, offset: number) => {
    await api.jukeboxSkip(index, offset)
  }

  jukebox.setGain = async(gain: number) => {
    await api.jukeboxSetGain(gain)
  }

  const store = new Vuex.Store({
    strict: true,
    modules: {
      player: {
        namespaced: true,
        ...playerModule
      },
    }
  })

  setInterval(async() => {
    const status = await api.jukeboxGet()

    // TODO: avoid setting these values if they're already set
    store.commit('player/setQueue', status.entry || [])
    store.commit('player/setQueueIndex', status.currentIndex)
    store.commit('player/setIsPlaying', status.playing)
    store.commit('player/setVolume', status.gain)
    store.commit('player/setCurrentTime', status.position)
  }, 1000)

  return store
}
