import React, { useState, useEffect } from 'react';
import { Heart, Music, Activity, Play, Pause, SkipForward, Settings } from 'lucide-react';

const HeartRateSpotifyApp = () => {
  const [heartRate, setHeartRate] = useState(72);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState('cardio');
  const [spotifyToken, setSpotifyToken] = useState('');
  const [showSetup, setShowSetup] = useState(true);

  const workoutTypes = [
    { id: 'cardio', name: 'Cardio', icon: '🏃', color: 'bg-red-500', range: '120-160 BPM' },
    { id: 'strength', name: 'Strength Training', icon: '💪', color: 'bg-blue-500', range: '90-120 BPM' },
    { id: 'yoga', name: 'Yoga/Stretching', icon: '🧘', color: 'bg-purple-500', range: '60-90 BPM' },
    { id: 'hiit', name: 'HIIT', icon: '🔥', color: 'bg-orange-500', range: '140-180 BPM' },
    { id: 'warmup', name: 'Warm Up', icon: '🌅', color: 'bg-yellow-500', range: '80-100 BPM' },
    { id: 'cooldown', name: 'Cool Down', icon: '❄️', color: 'bg-cyan-500', range: '60-80 BPM' }
  ];

  // Simulate heart rate monitoring
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      // Simulate heart rate fluctuation
      setHeartRate(prev => {
        const change = Math.random() * 10 - 5;
        const newRate = Math.max(50, Math.min(200, prev + change));
        return Math.round(newRate);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Queue songs based on heart rate - Initialize immediately when connected
  useEffect(() => {
    if (!isConnected) return;

    const matchingSongs = getMockSongsForBPM(heartRate, selectedWorkout);
    if (matchingSongs.length > 0) {
      setQueue(matchingSongs);
      // Set initial song immediately
      if (!currentSong) {
        setCurrentSong(matchingSongs[0]);
      }
    }
  }, [isConnected, selectedWorkout]);

  // Update queue when heart rate changes significantly
  useEffect(() => {
    if (!isConnected || !isPlaying) return;

    const matchingSongs = getMockSongsForBPM(heartRate, selectedWorkout);
    if (matchingSongs.length > 0 && queue.length > 0) {
      // Only update if BPM difference is significant
      if (Math.abs(queue[0].bpm - heartRate) > 10) {
        setQueue(matchingSongs);
      }
    }
  }, [heartRate, isConnected, isPlaying, selectedWorkout]);

  const getMockSongsForBPM = (bpm, workout) => {
    const songs = [
      { id: 1, name: 'Electric Feel', artist: 'MGMT', bpm: 112, workout: 'cardio' },
      { id: 2, name: 'Uptown Funk', artist: 'Bruno Mars', bpm: 115, workout: 'cardio' },
      { id: 3, name: 'Stronger', artist: 'Kanye West', bpm: 104, workout: 'strength' },
      { id: 4, name: 'Eye of the Tiger', artist: 'Survivor', bpm: 109, workout: 'strength' },
      { id: 5, name: 'Breathe', artist: 'Télépopmusik', bpm: 72, workout: 'yoga' },
      { id: 6, name: 'Weightless', artist: 'Marconi Union', bpm: 60, workout: 'yoga' },
      { id: 7, name: 'Till I Collapse', artist: 'Eminem', bpm: 171, workout: 'hiit' },
      { id: 8, name: 'Thunderstruck', artist: 'AC/DC', bpm: 133, workout: 'hiit' },
      { id: 9, name: 'Can\'t Stop', artist: 'Red Hot Chili Peppers', bpm: 118, workout: 'cardio' },
      { id: 10, name: 'Lose Yourself', artist: 'Eminem', bpm: 171, workout: 'hiit' },
      { id: 11, name: 'Work', artist: 'Rihanna', bpm: 92, workout: 'strength' },
      { id: 12, name: 'Sunflower', artist: 'Post Malone', bpm: 90, workout: 'warmup' },
      { id: 13, name: 'Levitating', artist: 'Dua Lipa', bpm: 103, workout: 'cardio' },
      { id: 14, name: 'Blinding Lights', artist: 'The Weeknd', bpm: 171, workout: 'cardio' },
      { id: 15, name: 'Don\'t Stop Me Now', artist: 'Queen', bpm: 156, workout: 'cardio' },
      { id: 16, name: 'Shallow', artist: 'Lady Gaga', bpm: 96, workout: 'warmup' },
      { id: 17, name: 'Say Something', artist: 'A Great Big World', bpm: 72, workout: 'yoga' },
      { id: 18, name: 'The Scientist', artist: 'Coldplay', bpm: 73, workout: 'cooldown' },
      { id: 19, name: 'Fix You', artist: 'Coldplay', bpm: 68, workout: 'cooldown' },
      { id: 20, name: 'Skinny Love', artist: 'Bon Iver', bpm: 75, workout: 'yoga' },
      { id: 21, name: 'Gravity', artist: 'John Mayer', bpm: 70, workout: 'cooldown' },
      { id: 22, name: 'Hallelujah', artist: 'Jeff Buckley', bpm: 68, workout: 'yoga' },
      { id: 23, name: 'Mad World', artist: 'Gary Jules', bpm: 82, workout: 'cooldown' },
      { id: 24, name: 'Chasing Cars', artist: 'Snow Patrol', bpm: 76, workout: 'cooldown' }
    ];

    // Filter by workout and find closest BPM matches
    const workoutSongs = songs.filter(s => s.workout === workout);
    return workoutSongs
      .map(song => ({ ...song, bpmDiff: Math.abs(song.bpm - bpm) }))
      .sort((a, b) => a.bpmDiff - b.bpmDiff)
      .slice(0, 8);
  };

  const connectSpotify = () => {
    if (spotifyToken.trim()) {
      setIsConnected(true);
      setShowSetup(false);
    }
  };

  const togglePlayback = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    
    // When starting playback, ensure we have a current song
    if (newPlayingState && !currentSong && queue.length > 0) {
      setCurrentSong(queue[0]);
    }
  };

  const skipSong = () => {
    const nextIndex = queue.findIndex(s => s.id === currentSong?.id) + 1;
    if (nextIndex < queue.length) {
      setCurrentSong(queue[nextIndex]);
    }
  };

  const getHeartRateColor = (hr) => {
    if (hr < 100) return 'text-green-500';
    if (hr < 140) return 'text-yellow-500';
    if (hr < 170) return 'text-orange-500';
    return 'text-red-500';
  };

  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <Heart className="w-12 h-12 text-red-500" fill="currentColor" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Beat</h1>
              <p className="text-gray-400">Connect your Spotify account to get started</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Spotify Access Token
                </label>
                <input
                  type="text"
                  value={spotifyToken}
                  onChange={(e) => setSpotifyToken(e.target.value)}
                  placeholder="Enter your Spotify API token"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-2 text-sm text-gray-400">
                  Get your token from the{' '}
                  <a href="https://developer.spotify.com/console/" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                    Spotify Developer Console
                  </a>
                </p>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Setup Instructions
                </h3>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>Visit the Spotify Developer Console</li>
                  <li>Log in with your Spotify account</li>
                  <li>Generate an access token with these scopes: user-modify-playback-state, user-read-playback-state</li>
                  <li>Paste the token above and click Connect</li>
                </ol>
              </div>

              <button
                onClick={connectSpotify}
                disabled={!spotifyToken.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Connect to Spotify
              </button>

              <button
                onClick={() => {
                  setIsConnected(true);
                  setShowSetup(false);
                }}
                className="w-full bg-gray-700 text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-600 transition-all"
              >
                Continue without Spotify (Demo Mode)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mr-3 shadow-lg">
              <div className="relative">
                <Heart className="w-10 h-10 text-red-500" fill="currentColor" />
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                  <div className="w-6 h-4 bg-red-500 rounded-full" style={{clipPath: 'polygon(0% 50%, 50% 0%, 100% 50%, 50% 100%)'}}></div>
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white">Beat</h1>
          </div>
          <p className="text-gray-400">Your music adapts to your heart rate in real-time</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Heart Rate Monitor */}
          <div className="md:col-span-2 bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Current Heart Rate</h2>
                <p className="text-gray-400 text-sm">Live monitoring active</p>
              </div>
              <button
                onClick={() => setShowSetup(true)}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-xl opacity-50"></div>
                <div className="relative bg-gray-900 rounded-full p-8">
                  <Heart className={`w-16 h-16 ${getHeartRateColor(heartRate)} animate-pulse`} />
                </div>
              </div>
              <div className="ml-8">
                <div className={`text-6xl font-bold ${getHeartRateColor(heartRate)}`}>
                  {heartRate}
                </div>
                <div className="text-gray-400 text-xl">BPM</div>
              </div>
            </div>

            {/* Current Song - Large Display */}
            {currentSong && (
              <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl p-6 mb-6 border border-gray-600">
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Music className="w-12 h-12 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Now Playing</p>
                    <h3 className="text-white font-bold text-2xl mb-1 truncate">{currentSong.name}</h3>
                    <p className="text-gray-300 text-lg truncate mb-2">{currentSong.artist}</p>
                    <div className="flex items-center space-x-3">
                      <span className="bg-green-500/20 text-green-400 text-sm font-semibold px-3 py-1 rounded-full">
                        {currentSong.bpm} BPM
                      </span>
                      <span className="text-gray-400 text-sm">
                        Matches your heart rate
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center space-x-4">
                  <button
                    onClick={togglePlayback}
                    className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-colors shadow-lg"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                  <button
                    onClick={skipSong}
                    className="bg-gray-600 hover:bg-gray-500 text-white p-4 rounded-full transition-colors"
                  >
                    <SkipForward className="w-6 h-6" />
                  </button>
                  <div className="flex-1 bg-gray-600 h-2 rounded-full overflow-hidden">
                    <div className="bg-green-500 h-full w-1/3 rounded-full transition-all duration-300"></div>
                  </div>
                  <span className="text-gray-400 text-sm">2:34</span>
                </div>
              </div>
            )}

            {/* Queue */}
            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Queue (Matched to Your BPM)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {queue.map((song, idx) => (
                  <div 
                    key={song.id} 
                    className={`rounded-lg p-3 flex items-center justify-between transition-all ${
                      currentSong?.id === song.id 
                        ? 'bg-green-600 shadow-lg' 
                        : 'bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex items-center justify-center w-8">
                        {currentSong?.id === song.id ? (
                          <div className="flex space-x-0.5">
                            <div className="w-1 bg-white h-4 animate-pulse"></div>
                            <div className="w-1 bg-white h-3 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-1 bg-white h-5 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          currentSong?.id === song.id ? 'text-white' : 'text-white'
                        }`}>
                          {song.name}
                        </p>
                        <p className={`text-xs truncate ${
                          currentSong?.id === song.id ? 'text-green-100' : 'text-gray-400'
                        }`}>
                          {song.artist}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-semibold ${
                        currentSong?.id === song.id ? 'text-white' : 'text-green-400'
                      }`}>
                        {song.bpm} BPM
                      </span>
                      {currentSong?.id === song.id && (
                        <Music className="w-4 h-4 text-white animate-pulse" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workout Selection */}
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">Workout Type</h2>
            <div className="space-y-3">
              {workoutTypes.map((workout) => (
                <button
                  key={workout.id}
                  onClick={() => setSelectedWorkout(workout.id)}
                  className={`w-full p-4 rounded-xl transition-all ${
                    selectedWorkout === workout.id
                      ? `${workout.color} text-white shadow-lg scale-105`
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{workout.icon}</span>
                    <div className="text-left flex-1">
                      <div className="font-semibold">{workout.name}</div>
                      <div className={`text-xs ${selectedWorkout === workout.id ? 'text-white/80' : 'text-gray-400'}`}>
                        {workout.range}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 text-sm">How it works</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                As your heart rate changes during your workout, the app automatically queues songs that match your current BPM, keeping you in the zone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeartRateSpotifyApp;
