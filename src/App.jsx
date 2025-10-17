import React, { useState, useEffect, useCallback } from 'react';
import { Heart, Music, Activity, Play, Pause, SkipForward, Settings, Mail, Lock, User, ArrowLeft, LogOut } from 'lucide-react';

// ----------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------

// Basic Email Regex for client-side validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Utility function to format milliseconds into M:SS string
const formatTime = (ms) => {
  if (ms === null || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Starter Kit Song IDs for each category
const STARTER_KIT_SONG_IDS = {
    cardio: [1, 2, 15],       // Electric Feel, Uptown Funk, Do Not Stop Me Now
    strength: [3, 4, 11],     // Stronger, Eye of the Tiger, Work
    yoga: [5, 6, 17],         // Breathe, Weightless, Say Something
    hiit: [7, 10, 25],        // Till I Collapse, Lose Yourself, Physical
    warmup: [12, 16, 28],     // Sunflower, Shallow, Sweet Caroline
    cooldown: [18, 19, 21]    // The Scientist, Fix You, Gravity
};

// Full Mock Song Database (with realistic durationMs added)
const ALL_MOCK_SONGS = [
    // Duration in MS: M:SS
    { id: 1, name: 'Electric Feel', artist: 'MGMT', bpm: 112, workout: 'cardio', durationMs: 228000 }, // 3:48
    { id: 2, name: 'Uptown Funk', artist: 'Bruno Mars', bpm: 115, workout: 'cardio', durationMs: 270000 }, // 4:30
    { id: 3, name: 'Stronger', artist: 'Kanye West', bpm: 104, workout: 'strength', durationMs: 247000 }, // 4:07
    { id: 4, name: 'Eye of the Tiger', artist: 'Survivor', bpm: 109, workout: 'strength', durationMs: 245000 }, // 4:05
    { id: 5, name: 'Breathe', artist: 'Telepopmusik', bpm: 72, workout: 'yoga', durationMs: 266000 }, // 4:26
    { id: 6, name: 'Weightless', artist: 'Marconi Union', bpm: 60, workout: 'yoga', durationMs: 625000 }, // 10:25
    { id: 7, name: 'Till I Collapse', artist: 'Eminem', bpm: 171, workout: 'hiit', durationMs: 268000 }, // 4:28
    { id: 8, name: 'Thunderstruck', artist: 'AC/DC', bpm: 133, workout: 'hiit', durationMs: 292000 }, // 4:52
    { id: 9, name: 'Cannot Stop', artist: 'Red Hot Chili Peppers', bpm: 118, workout: 'cardio', durationMs: 269000 }, // 4:29
    { id: 10, name: 'Lose Yourself', artist: 'Eminem', bpm: 171, workout: 'hiit', durationMs: 326000 }, // 5:26
    { id: 11, name: 'Work', artist: 'Rihanna', bpm: 92, workout: 'strength', durationMs: 219000 }, // 3:39
    { id: 12, name: 'Sunflower', artist: 'Post Malone', bpm: 90, workout: 'warmup', durationMs: 161000 }, // 2:41
    { id: 13, name: 'Levitating', artist: 'Dua Lipa', bpm: 103, workout: 'cardio', durationMs: 203000 }, // 3:23
    { id: 14, name: 'Blinding Lights', artist: 'The Weeknd', bpm: 171, workout: 'cardio', durationMs: 200000 }, // 3:20
    { id: 15, name: 'Do Not Stop Me Now', artist: 'Queen', bpm: 156, workout: 'cardio', durationMs: 216000 }, // 3:36
    { id: 16, name: 'Shallow', artist: 'Lady Gaga', bpm: 96, workout: 'warmup', durationMs: 218000 }, // 3:38
    { id: 17, name: 'Say Something', artist: 'A Great Big World', bpm: 72, workout: 'yoga', durationMs: 272000 }, // 4:32
    { id: 18, name: 'The Scientist', artist: 'Coldplay', bpm: 73, workout: 'cooldown', durationMs: 309000 }, // 5:09
    { id: 19, name: 'Fix You', artist: 'Coldplay', bpm: 68, workout: 'cooldown', durationMs: 295000 }, // 4:55
    { id: 20, name: 'Skinny Love', artist: 'Bon Iver', bpm: 75, workout: 'yoga', durationMs: 201000 }, // 3:21
    { id: 21, name: 'Gravity', artist: 'John Mayer', bpm: 70, workout: 'cooldown', durationMs: 245000 }, // 4:05
    { id: 22, name: 'Hallelujah', artist: 'Jeff Buckley', bpm: 68, workout: 'yoga', durationMs: 413000 }, // 6:53
    { id: 23, name: 'Mad World', artist: 'Gary Jules', bpm: 82, workout: 'cooldown', durationMs: 185000 }, // 3:05
    { id: 24, name: 'Chasing Cars', artist: 'Snow Patrol', bpm: 76, workout: 'cooldown', durationMs: 267000 }, // 4:27
    { id: 25, name: 'Physical', artist: 'Dua Lipa', bpm: 147, workout: 'hiit', durationMs: 193000 }, // 3:13
    { id: 26, name: 'Higher Love', artist: 'Kygo, Whitney Houston', bpm: 104, workout: 'cardio', durationMs: 225000 }, // 3:45
    { id: 27, name: 'Old Town Road', artist: 'Lil Nas X', bpm: 136, workout: 'strength', durationMs: 157000 }, // 2:37
    { id: 28, name: 'Sweet Caroline', artist: 'Neil Diamond', bpm: 125, workout: 'warmup', durationMs: 232000 }, // 3:52
    { id: 29, name: 'Strawberry Swing', artist: 'Coldplay', bpm: 90, workout: 'yoga', durationMs: 235000 }, // 3:55
    { id: 30, name: 'One Dance', artist: 'Drake', bpm: 104, workout: 'strength', durationMs: 174000 }, // 2:54
];


export default function App() {
  const [heartRate, setHeartRate] = useState(72);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState('cardio');
  const [spotifyToken, setSpotifyToken] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  
  // State for music progress
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0); // in milliseconds

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotUsername, setShowForgotUsername] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');

  const workoutTypes = [
    { id: 'cardio', name: 'Cardio', icon: '🏃', color: 'bg-red-500', range: '120-160 BPM' },
    { id: 'strength', name: 'Strength Training', icon: '💪', color: 'bg-blue-500', range: '90-120 BPM' },
    { id: 'yoga', name: 'Yoga/Stretching', icon: '🧘', color: 'bg-purple-500', range: '60-90 BPM' },
    { id: 'hiit', name: 'HIIT', icon: '🔥', color: 'bg-orange-500', range: '140-180 BPM' },
    { id: 'warmup', name: 'Warm Up', icon: '🌅', color: 'bg-yellow-500', range: '80-100 BPM' },
    { id: 'cooldown', name: 'Cool Down', icon: '❄️', color: 'bg-cyan-500', range: '60-80 BPM' }
  ];

  // 1. Heart Rate Simulation (unchanged)
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      setHeartRate(prev => {
        const change = Math.random() * 10 - 5;
        const newRate = Math.max(50, Math.min(200, prev + change));
        return Math.round(newRate);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isConnected]);

  /**
   * Generates the song queue based on current heart rate, workout type, and starter kit.
   * @param {number} bpm - The current heart rate.
   * @param {string} workout - The selected workout category.
   * @returns {Array} The prioritized song queue.
   */
  const getMockSongsForBPM = (bpm, workout) => {
    // 1. Dynamic Matching: Filter songs in the workout category that are within +/- 20 BPM.
    const workoutSongs = ALL_MOCK_SONGS.filter(s => s.workout === workout);
    let dynamicMatches = workoutSongs
      .filter(song => Math.abs(song.bpm - bpm) <= 20)
      .map(song => ({ ...song, bpmDiff: Math.abs(song.bpm - bpm) }))
      .sort((a, b) => a.bpmDiff - b.bpmDiff) // Sort by closest BPM match
      .slice(0, 8); // Top 8 matches

    // 2. Starter Kit: Get the fixed starter songs for the selected workout
    const starterIds = STARTER_KIT_SONG_IDS[workout] || [];
    const starterSongs = starterIds
        .map(id => ALL_MOCK_SONGS.find(s => s.id === id))
        .filter(s => s); // Filter out any undefined

    // 3. Combine: Prioritize dynamic matches, then append unique starter songs.
    const finalQueue = [...dynamicMatches];
    const existingIds = new Set(dynamicMatches.map(s => s.id));

    starterSongs.forEach(starter => {
        if (!existingIds.has(starter.id)) {
            // Ensure the song object has a bpmDiff property for consistency
            finalQueue.push({ ...starter, bpmDiff: Math.abs(starter.bpm - bpm) });
        }
    });

    // Limit the total queue size for display purposes
    return finalQueue.slice(0, 10);
  };
  
  // Helper function to find the best song for a starting BPM (72 BPM)
  const getInitialSong = (bpm = 72) => {
    // The initial selectedWorkout is 'cardio', but 'yoga' (60-90 BPM) or 'cooldown' (60-80 BPM)
    // are better matches for a 72 BPM resting heart rate. We will use 'yoga' for a diverse starting track.
    const initialWorkout = 'yoga'; 
    return getMockSongsForBPM(bpm, initialWorkout)[0];
  };


  // 2. LIVE QUEUEING MECHANISM (Triggers when heartRate or selectedWorkout changes)
  const updateQueueAndSong = useCallback((hr, workout) => {
    if (!isConnected) return;
    
    const songsForBPM = getMockSongsForBPM(hr, workout); 

    if (songsForBPM.length === 0) {
      setQueue([]);
      // If no songs match, stop playback if a song is currently playing
      if(currentSong) setCurrentSong(null);
      return;
    }

    const newBestSong = songsForBPM[0];
    
    // Check if the current song is still the best or in the top 8
    const currentSongMatch = currentSong ? songsForBPM.find(s => s.id === currentSong.id) : null;

    if (currentSongMatch) {
        // If current song is a match, keep it at the top of the queue and ensure playback continues
        const otherSongs = songsForBPM.filter(s => s.id !== currentSong.id);
        setQueue([currentSong, ...otherSongs]);
    } else {
        // Current song is no longer a match or is null, update to the new best song
        setQueue(songsForBPM);
        if (isPlaying || !currentSong) { 
            setCurrentSong(newBestSong);
        } else {
            // If paused, just update the queue, don't change the current song
        }
    }
  }, [isConnected, currentSong, isPlaying]);

  // Combined Effect Hook for real-time updates
  useEffect(() => {
    updateQueueAndSong(heartRate, selectedWorkout);
  }, [heartRate, selectedWorkout, isConnected, updateQueueAndSong]);

  // Reset playback time when a new song is set
  useEffect(() => {
    if (currentSong) {
        setCurrentPlaybackTime(0);
        // Ensure player starts if a song is set and we're connected
        if (!isPlaying && isConnected) {
            setIsPlaying(true);
        }
    }
  }, [currentSong, isConnected]);
  
  // Real-time Playback Timer and Auto-Skip
  useEffect(() => {
    if (!isPlaying || !currentSong) {
        return;
    }

    const interval = setInterval(() => {
        setCurrentPlaybackTime(prev => {
            const newTime = prev + 1000;
            // Check if song is over
            if (currentSong.durationMs && newTime >= currentSong.durationMs) {
                // Time is up, skip to next song
                // We use a safe sequential skip logic
                const nextIndex = queue.findIndex(s => s.id === currentSong.id) + 1;
                if (nextIndex < queue.length) {
                    setCurrentSong(queue[nextIndex]);
                } else {
                    // Loop back to the first song if end of list is reached
                    setCurrentSong(queue[0]);
                }
                return 0; 
            }
            return newTime;
        });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong, queue]);

  // Skip logic
  const skipSong = () => {
    const nextIndex = queue.findIndex(s => s.id === currentSong?.id) + 1;
    if (nextIndex < queue.length) {
      setCurrentSong(queue[nextIndex]);
    } else if (queue.length > 0) {
      // Loop back to the first song
      setCurrentSong(queue[0]);
    }
  };

  /**
   * Handler to allow user to scrub/jump to a new position in the song.
   * @param {React.MouseEvent<HTMLDivElement>} e The mouse event from clicking the progress bar.
   */
  const handleScrub = (e) => {
    if (!currentSong) return;
    
    // Get the element and its boundaries
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    
    // Calculate the click position relative to the element's start
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // Calculate the new time ratio and convert to milliseconds
    const newTimeRatio = clickX / width;
    const newTimeMs = Math.floor(newTimeRatio * currentSong.durationMs);
    
    // Update playback time
    setCurrentPlaybackTime(Math.max(0, Math.min(currentSong.durationMs, newTimeMs)));
    
    // Ensure playback restarts immediately if it was paused
    if (!isPlaying) {
        setIsPlaying(true);
    }
  };

  // Authentication Handlers 
  const handleLogin = (e) => {
    if (e) e.preventDefault();
    
    if (loginEmail.trim() && loginPassword.trim()) {
      const name = loginEmail.split('@')[0];
      
      setUserProfile({
        name: name,
        email: loginEmail
      });
      setIsAuthenticated(true);
      // STARTER MUSIC: Automatically connects and starts playing the initial queued song
      setIsConnected(true); 
      setIsPlaying(true);
      setCurrentSong(getInitialSong()); // Set the initial song
    } else {
      alert('Please enter email and password');
    }
  };

  const handleSignUp = () => {
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim() || !signupConfirmPassword.trim()) {
      alert('Please fill in all fields');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    
    // MOCK SUCCESS
    setUserProfile({
      name: signupName,
      email: signupEmail
    });
    
    setIsAuthenticated(true);
    // STARTER MUSIC: Automatically connects and starts playing the initial queued song
    setIsConnected(true); 
    setIsPlaying(true);
    setCurrentSong(getInitialSong()); // Set the initial song
  };
  
  // Handlers for Forgot/Reset Flows (omitted for brevity, mostly unchanged)
  const handleForgotUsername = () => {
    if (forgotEmail.trim()) {
      setEmailSentMessage('We\'ve sent your username to ' + forgotEmail + '. Please check your inbox and spam folder.');
      setShowEmailSent(true);
      setShowForgotUsername(false);
      setForgotEmail('');
      setShowLogin(false);
      setIsSignUp(false);
    } else {
      alert('Please enter your email');
    }
  };

  const handleForgotPassword = () => {
    if (forgotEmail.trim()) {
      setEmailSentMessage('We\'ve sent a password reset link to ' + forgotEmail + '. Please check your inbox and spam folder.');
      setShowEmailSent(true);
      setShowForgotPassword(false);
      setForgotEmail('');
      setShowLogin(false);
      setIsSignUp(false);
    } else {
      alert('Please enter your email');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserProfile(null);
    setIsConnected(false);
    setShowSetup(false);
    setLoginEmail('');
    setLoginPassword('');
    // Reset music state
    setCurrentSong(null);
    setIsPlaying(false);
    setQueue([]);
    setCurrentPlaybackTime(0);
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
    
    // If starting playback and no song is loaded, load the best initial song
    if (newPlayingState && !currentSong && queue.length > 0) {
      setCurrentSong(queue[0]);
    }
  };

  const getHeartRateColor = (hr) => {
    if (hr < 100) return 'text-green-500';
    if (hr < 140) return 'text-yellow-500';
    if (hr < 170) return 'text-orange-500';
    return 'text-red-500';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <Heart className="w-12 h-12 text-red-500" fill="currentColor" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Beat</h1>
              <p className="text-gray-400">Your music, synced to your heartbeat</p>
            </div>

            {(showForgotUsername || showForgotPassword) && !showEmailSent && (
              <div>
                <button
                  onClick={() => {
                      setShowForgotUsername(false); 
                      setShowForgotPassword(false);
                      setShowLogin(true);
                      setForgotEmail('');
                  }}
                  className="flex items-center text-purple-400 hover:text-purple-300 mb-4 transition-colors font-semibold"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sign In
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">
                    {showForgotUsername ? 'Recover Username' : 'Reset Password'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={showForgotUsername ? handleForgotUsername : handleForgotPassword}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    Send {showForgotUsername ? 'Username' : 'Reset Link'}
                  </button>
                </div>
              </div>
            )}
            
            {showEmailSent && (
              <div className="text-center p-4">
                <Mail className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-4">Success!</h2>
                <p className="text-gray-400 mb-6">{emailSentMessage}</p>
                <button
                  onClick={() => { setShowEmailSent(false); setShowLogin(true); setEmailSentMessage('');}}
                  className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 transition-all"
                >
                  OK
                </button>
              </div>
            )}


            {showLogin && !isSignUp && !showForgotPassword && !showForgotUsername && !showEmailSent && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {setShowForgotUsername(true); setShowLogin(false);}}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot username?
                    </button>
                    <button
                      type="button"
                      onClick={() => {setShowForgotPassword(true); setShowLogin(false);}}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    onClick={handleLogin}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    Sign In
                  </button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-gray-400">
                    Don't have an account?{' '}
                    <button
                      onClick={() => {setIsSignUp(true); setShowLogin(false);}}
                      className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </div>
            )}

            {isSignUp && !showForgotPassword && !showForgotUsername && !showEmailSent && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSignUp}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all"
                  >
                    Create Account
                  </button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-gray-400">
                    Already have an account?{' '}
                    <button
                      onClick={() => setIsSignUp(false)}
                      className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                    >
                      Sign In
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
