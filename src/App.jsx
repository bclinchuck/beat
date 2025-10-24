import SpotifyTrackProvider from "./providers/SpotifyTrackProvider.js";
import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  Music,
  Activity,
  Play,
  Pause,
  SkipForward,
  Settings,
  Mail,
  Lock,
  User,
  ArrowLeft,
  LogOut,
  Camera,
} from 'lucide-react';

// ----------------------------------------------------------------------
// (Optional) Spotify constants if you later add real OAuth/PKCE
// ----------------------------------------------------------------------
const SPOTIFY_CLIENT_ID = 'c4eb99c2c9674add898d83530e45d7be';
const SPOTIFY_REDIRECT_URI = 'http://localhost:3000/callback';
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-modify-public',
].join(' ');

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

export default function App() {
  const [heartRate, setHeartRate] = useState(72);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState('cardio');
  const [showSetup, setShowSetup] = useState(false);
  const [provider, setProvider] = useState(null);
  const [spotifyToken, setSpotifyToken] = useState('');

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

  // Profile and Settings
  const [userProfile, setUserProfile] = useState(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState(
    'https://via.placeholder.com/150/9333ea/FFFFFF?text=P'
  );
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  // Form states
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [signupError, setSignupError] = useState('');

  const workoutTypes = [
    { id: 'cardio', name: 'Cardio', icon: '🏃', color: 'bg-red-500', range: '120-160 BPM' },
    { id: 'strength', name: 'Strength Training', icon: '💪', color: 'bg-blue-500', range: '90-120 BPM' },
    { id: 'yoga', name: 'Yoga/Stretching', icon: '🧘', color: 'bg-purple-500', range: '60-90 BPM' },
    { id: 'hiit', name: 'HIIT', icon: '🔥', color: 'bg-orange-500', range: '140-180 BPM' },
    { id: 'warmup', name: 'Warm Up', icon: '🌅', color: 'bg-yellow-500', range: '80-100 BPM' },
    { id: 'cooldown', name: 'Cool Down', icon: '❄️', color: 'bg-cyan-500', range: '60-80 BPM' },
  ];

  // 1) Heart Rate Simulation
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setHeartRate((prev) => {
        const change = Math.random() * 10 - 5;
        const newRate = Math.max(50, Math.min(200, prev + change));
        return Math.round(newRate);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // 2) Demo Mock Song Database (fallback when not connected to Spotify)
  const getMockSongsForBPM = (bpm, workout) => {
    const songs = [
      { id: 1, name: 'Electric Feel', artist: 'MGMT', bpm: 112, workout: 'cardio', durationMs: 228000 },
      { id: 2, name: 'Uptown Funk', artist: 'Bruno Mars', bpm: 115, workout: 'cardio', durationMs: 270000 },
      { id: 3, name: 'Stronger', artist: 'Kanye West', bpm: 104, workout: 'strength', durationMs: 247000 },
      { id: 4, name: 'Eye of the Tiger', artist: 'Survivor', bpm: 109, workout: 'strength', durationMs: 245000 },
      { id: 5, name: 'Breathe', artist: 'Telepopmusik', bpm: 72, workout: 'yoga', durationMs: 266000 },
      { id: 6, name: 'Weightless', artist: 'Marconi Union', bpm: 60, workout: 'yoga', durationMs: 625000 },
      { id: 7, name: 'Till I Collapse', artist: 'Eminem', bpm: 171, workout: 'hiit', durationMs: 268000 },
      { id: 8, name: 'Thunderstruck', artist: 'AC/DC', bpm: 133, workout: 'hiit', durationMs: 292000 },
      { id: 9, name: 'Cannot Stop', artist: 'Red Hot Chili Peppers', bpm: 118, workout: 'cardio', durationMs: 269000 },
      { id:10, name: 'Lose Yourself', artist: 'Eminem', bpm: 171, workout: 'hiit', durationMs: 326000 },
      { id:11, name: 'Work', artist: 'Rihanna', bpm: 92,  workout: 'strength', durationMs: 219000 },
      { id:12, name: 'Sunflower', artist: 'Post Malone', bpm: 90, workout: 'warmup', durationMs: 161000 },
      { id:13, name: 'Levitating', artist: 'Dua Lipa', bpm: 103, workout: 'cardio', durationMs: 203000 },
      { id:14, name: 'Blinding Lights', artist: 'The Weeknd', bpm: 171, workout: 'cardio', durationMs: 200000 },
      { id:15, name: 'Do Not Stop Me Now', artist: 'Queen', bpm: 156, workout: 'cardio', durationMs: 216000 },
      { id:16, name: 'Shallow', artist: 'Lady Gaga', bpm: 96, workout: 'warmup', durationMs: 218000 },
      { id:17, name: 'Say Something', artist: 'A Great Big World', bpm: 72, workout: 'yoga', durationMs: 272000 },
      { id:18, name: 'The Scientist', artist: 'Coldplay', bpm: 73, workout: 'cooldown', durationMs: 309000 },
      { id:19, name: 'Fix You', artist: 'Coldplay', bpm: 68, workout: 'cooldown', durationMs: 295000 },
      { id:20, name: 'Skinny Love', artist: 'Bon Iver', bpm: 75, workout: 'yoga', durationMs: 201000 },
      { id:21, name: 'Gravity', artist: 'John Mayer', bpm: 70, workout: 'cooldown', durationMs: 245000 },
      { id:22, name: 'Hallelujah', artist: 'Jeff Buckley', bpm: 68, workout: 'yoga', durationMs: 413000 },
      { id:23, name: 'Mad World', artist: 'Gary Jules', bpm: 82, workout: 'cooldown', durationMs: 185000 },
      { id:24, name: 'Chasing Cars', artist: 'Snow Patrol', bpm: 76, workout: 'cooldown', durationMs: 267000 },
      { id:25, name: 'Physical', artist: 'Dua Lipa', bpm: 147, workout: 'hiit', durationMs: 193000 },
      { id:26, name: 'Higher Love', artist: 'Kygo, Whitney Houston', bpm: 104, workout: 'cardio', durationMs: 225000 },
      { id:27, name: 'Old Town Road', artist: 'Lil Nas X', bpm: 136, workout: 'strength', durationMs: 157000 },
      { id:28, name: 'Sweet Caroline', artist: 'Neil Diamond', bpm: 125, workout: 'warmup', durationMs: 232000 },
      { id:29, name: 'Strawberry Swing', artist: 'Coldplay', bpm: 90, workout: 'yoga', durationMs: 235000 },
      { id:30, name: 'One Dance', artist: 'Drake', bpm: 104, workout: 'strength', durationMs: 174000 },
    ];
    const workoutSongs = songs.filter((s) => s.workout === workout);
    return workoutSongs
      .filter((song) => Math.abs(song.bpm - bpm) <= 20)
      .map((song) => ({ ...song, bpmDiff: Math.abs(song.bpm - bpm) }))
      .sort((a, b) => a.bpmDiff - b.bpmDiff)
      .slice(0, 8);
  };

  // Playback: reset time when song changes
  useEffect(() => {
    if (currentSong) {
      setCurrentPlaybackTime(0);
      if (!isPlaying) setIsPlaying(true);
    }
  }, [currentSong, isPlaying]);

  // Playback: tick + auto-skip
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const interval = setInterval(() => {
      setCurrentPlaybackTime((prev) => {
        const newTime = prev + 1000;
        if (currentSong && newTime >= currentSong.durationMs) {
          skipSong();
          return 0;
        }
        return newTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  // Skip handler
  const skipSong = useCallback(() => {
    setQueue((prevQueue) => {
      if (!currentSong) return prevQueue;
      const nextIndex = prevQueue.findIndex((s) => s.id === currentSong.id) + 1;
      if (nextIndex < prevQueue.length) {
        setCurrentSong(prevQueue[nextIndex]);
        return prevQueue;
      } else if (prevQueue.length > 0) {
        setCurrentSong(prevQueue[0]);
        return prevQueue;
      } else {
        setCurrentSong(null);
        return prevQueue;
      }
    });
  }, [currentSong]);

  // --- NEW: unified queue updater that prefers Spotify provider if available
  const updateQueueAndSong = useCallback(
    async (hr, workout) => {
      if (!isConnected) return;
      try {
        let songsForBPM = [];
        if (provider) {
          songsForBPM = await provider.getRecommendations(hr, workout);
        } else {
          songsForBPM = getMockSongsForBPM(hr, workout);
        }

        if (!songsForBPM || songsForBPM.length === 0) {
          setQueue([]);
          if (currentSong) setCurrentSong(null);
          return;
        }

        const newBestSong = songsForBPM[0];
        const currentSongMatch = currentSong
          ? songsForBPM.find((s) => s.id === currentSong.id)
          : null;

        if (currentSongMatch) {
          const otherSongs = songsForBPM.filter((s) => s.id !== currentSong.id);
          setQueue([currentSong, ...otherSongs]);
        } else {
          setQueue(songsForBPM);
          if (isPlaying || !currentSong) {
            setCurrentSong(newBestSong);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Spotify token may be invalid/expired. Falling back to demo tracks.');
        setProvider(null);
        const fallback = getMockSongsForBPM(hr, workout);
        setQueue(fallback);
        if (!currentSong && fallback.length) setCurrentSong(fallback[0]);
      }
    },
    [isConnected, provider, currentSong, isPlaying]
  );

  // call updater when HR/workout/connection/provider change
  useEffect(() => {
    updateQueueAndSong(heartRate, selectedWorkout);
  }, [heartRate, selectedWorkout, isConnected, provider, updateQueueAndSong]);

  // Scrub handler
  const handleScrub = (e) => {
    if (!currentSong) return;
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTimeRatio = clickX / width;
    const newTimeMs = Math.floor(newTimeRatio * currentSong.durationMs);
    setCurrentPlaybackTime(Math.max(0, Math.min(currentSong.durationMs, newTimeMs)));
    if (!isPlaying) setIsPlaying(true);
  };

  // Auth handlers
  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (loginIdentifier.trim() && loginPassword.trim()) {
      const isEmail = EMAIL_REGEX.test(loginIdentifier);
      const name = isEmail ? loginIdentifier.split('@')[0] : loginIdentifier;
      setUserProfile({
        name: name,
        username: name,
        email: isEmail ? loginIdentifier : `${loginIdentifier}@mockuser.com`,
      });
      setIsAuthenticated(true);
      setIsConnected(true);
      setIsPlaying(true);
    } else {
      alert('Please enter a username or email and password');
    }
  };

  const handleSignUp = () => {
    setSignupError('');
    if (
      !signupName.trim() ||
      !signupUsername.trim() ||
      !signupEmail.trim() ||
      !signupPassword.trim() ||
      !signupConfirmPassword.trim()
    ) {
      setSignupError('Please fill in all fields.');
      return;
    }
    if (!EMAIL_REGEX.test(signupEmail)) {
      setSignupError('Please enter a valid email address.');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError('Passwords do not match!');
      return;
    }
    setUserProfile({ name: signupName, username: signupUsername, email: signupEmail });
    setIsAuthenticated(true);
    setIsConnected(true);
    setShowSetup(false);
    setIsPlaying(true);
  };

  const handleForgotUsername = () => {
    setForgotError('');
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setEmailSentMessage(`An email with your username has been sent to ${forgotEmail}.`);
    setShowEmailSent(true);
    setShowForgotUsername(false);
  };

  const handleForgotPassword = () => {
    setForgotError('');
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setEmailSentMessage(`A password reset link has been sent to ${forgotEmail}.`);
    setShowEmailSent(true);
    setShowForgotPassword(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserProfile(null);
    setIsConnected(false);
    setShowSetup(false);
    setShowProfileSettings(false);
    setProfilePictureUrl('https://via.placeholder.com/150/9333ea/FFFFFF?text=P');
    setLoginIdentifier('');
    setLoginPassword('');
    setShowLogin(true);
    setIsSignUp(false);
    setShowEmailSent(false);
    setForgotEmail('');
    setForgotError('');
    setCurrentSong(null);
    setIsPlaying(false);
    setQueue([]);
    setCurrentPlaybackTime(0);
    setProvider(null);
    setSpotifyToken('');
  };

  const connectSpotify = () => {
    if (SPOTIFY_ACCESS_TOKEN.trim()) {
      setProvider(new SpotifyTrackProvider(SPOTIFY_ACCESS_TOKEN.trim())); 
      setIsConnected(true);
      setShowSetup(false);
      setIsPlaying(true);
      console.log("✅ Connected to Spotify with live data!");
    } else {
      alert("Please provide a valid Spotify token.");
    }
  };
  

  const handleProfilePictureChange = (newUrl) => {
    if (newUrl.trim()) {
      setProfilePictureUrl(newUrl);
      setShowProfileSettings(false);
      alert('Profile picture updated!');
    } else {
      alert('Please enter a valid image URL.');
    }
  };

  const togglePlayback = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
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

  // Profile Settings Modal
  const ProfileSettingsModal = () => {
    const [tempUrl, setTempUrl] = useState(profilePictureUrl);
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>
          <div className="flex flex-col items-center mb-6">
            <img src={profilePictureUrl} alt="Profile" className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-purple-500 shadow-xl" />
            <button
              onClick={() => document.getElementById('image-upload').click()}
              className="flex items-center text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Camera className="w-4 h-4 mr-1" /> Change Picture (Demo)
            </button>
            <input
              type="file"
              id="image-upload"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) alert(`File selected: ${file.name}. Simulating upload success...`);
              }}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-white font-semibold mb-2">Mock Image URL Input</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label>
              <input
                type="text"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="Enter new image URL"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={() => handleProfilePictureChange(tempUrl)}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Save Picture
            </button>
            <button
              onClick={() => setShowProfileSettings(false)}
              className="w-full bg-gray-700 text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (showProfileSettings) {
    return <ProfileSettingsModal />;
  }

  // --- Authentication UI ---
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

            {showForgotUsername && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Recover Username</h2>
                <p className="text-gray-400 mb-4">Enter your email address and we'll send you your username.</p>
                {forgotError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {forgotError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleForgotUsername}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    Send Username
                  </button>
                </div>
                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setShowForgotUsername(false); setShowLogin(true); setForgotEmail(''); setForgotError(''); }}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 inline-block mr-2" /> Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {showForgotPassword && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Reset Password</h2>
                <p className="text-gray-400 mb-4">Enter your email address and we'll send you a reset link.</p>
                {forgotError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {forgotError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                        placeholder="your@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleForgotPassword}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
                  >
                    Send Reset Link
                  </button>
                </div>
                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setShowForgotPassword(false); setShowLogin(true); setForgotEmail(''); setForgotError(''); }}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 inline-block mr-2" /> Back to Sign In
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
                  onClick={() => { setShowEmailSent(false); setShowLogin(true); setForgotEmail(''); setForgotError(''); }}
                  className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 transition-all"
                >
                  OK
                </button>
              </div>
            )}

            {showLogin && !isSignUp && !showForgotUsername && !showForgotPassword && !showEmailSent && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email or Username</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        placeholder="username or your@email.com"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
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
                      onClick={() => { setShowForgotUsername(true); setShowLogin(false); }}
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot username?
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPassword(true); setShowLogin(false); }}
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
                      onClick={() => setIsSignUp(true)}
                      className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </div>
            )}

            {isSignUp && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>
                {signupError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">{signupError}</div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        placeholder="mybeatname"
                        className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
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
  }

  // --- SETUP SCREEN (Add token input + Connect button) ---
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
              <h1 className="text-3xl font-bold text-white mb-2">Beat Setup</h1>
              <p className="text-gray-400">Connect your Spotify account to sync your music</p>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-700 rounded-lg p-6 text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Authorize Spotify (Demo)</h3>
                <p className="text-gray-400 mb-4">This demo button simulates an OAuth redirect.</p>
                <button
                  onClick={connectSpotify}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all"
                >
                  Connect with Spotify
                </button>
                <p className="text-sm text-red-400 mt-2">
                  NOTE: For real OAuth you’ll add a backend. For class demos, use the token box below.
                </p>
              </div>

              <div className="bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-2">Paste Access Token</h3>
                <p className="text-gray-400 mb-4 text-sm">
                  From Spotify Web API Console → “Get Token”. Paste it here to fetch live recommendations.
                </p>
                <input
                  type="text"
                  value={spotifyToken}
                  onChange={(e) => setSpotifyToken(e.target.value)}
                  placeholder="Paste Spotify access token"
                  className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 mb-3"
                />
                <button
                  onClick={() => {
                    if (spotifyToken.trim()) {
                      setProvider(new SpotifyTrackProvider(spotifyToken.trim()));
                      setIsConnected(true);
                      setShowSetup(false);
                      setIsPlaying(true);
                    } else {
                      alert('Paste a Spotify access token first.');
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold"
                >
                  Connect with Token
                </button>
                <p className="text-xs text-gray-400 mt-2">Tokens expire (~1 hour). Grab a fresh one when needed.</p>
              </div>

              <div className="flex items-center justify-center">
                <div className="w-full border-t border-gray-700"></div>
                <span className="px-3 text-gray-500 text-sm">OR</span>
                <div className="w-full border-t border-gray-700"></div>
              </div>

              <button
                onClick={() => { setIsConnected(true); setShowSetup(false); setIsPlaying(true); }}
                className="w-full bg-gray-700 text-gray-300 py-3 rounded-lg text-lg hover:bg-gray-600 transition-all"
              >
                Continue without Spotify (Demo Mode)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APPLICATION UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <Heart className="w-8 h-8 text-red-500" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Beat</h1>
              <p className="text-gray-400 text-sm">Your music adapts to your heart rate</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 rounded-xl p-3 flex items-center space-x-3 border border-gray-700">
              <div
                className="w-10 h-10 rounded-full overflow-hidden cursor-pointer group relative"
                onClick={() => setShowProfileSettings(true)}
              >
                <img src={profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-white font-semibold text-sm">{userProfile?.name}</p>
                <p className="text-gray-400 text-xs">@{userProfile?.username}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Player + HR + Queue */}
          <div className="md:col-span-2 bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Current Heart Rate</h2>
                <p className="text-gray-400 text-sm">Live monitoring active</p>
              </div>
              <button onClick={() => setShowSetup(true)} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
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
                <div className={`text-6xl font-bold ${getHeartRateColor(heartRate)}`}>{heartRate}</div>
                <div className="text-gray-400 text-xl">BPM</div>
              </div>
            </div>

            {currentSong ? (
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
                    </div>
                  </div>
                </div>

                {/* Progress Bar and Time Display */}
                <div className="mt-6 flex items-center space-x-4">
                  <button onClick={togglePlayback} className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-colors shadow-lg">
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>
                  <button onClick={skipSong} className="bg-gray-600 hover:bg-gray-500 text-white p-4 rounded-full transition-colors">
                    <SkipForward className="w-6 h-6" />
                  </button>

                  <span className="text-gray-400 text-sm">{formatTime(currentPlaybackTime)}</span>

                  <div className="flex-1 bg-gray-600 h-2 rounded-full overflow-hidden cursor-pointer group" onClick={handleScrub}>
                    <div
                      className="bg-green-500 h-full transition-none"
                      style={{
                        width: `${(currentPlaybackTime / currentSong.durationMs) * 100}%`,
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                      }}
                    ></div>
                  </div>

                  <span className="text-gray-400 text-sm">{formatTime(currentSong.durationMs)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-xl p-6 mb-6 text-center text-gray-400 border border-gray-600">
                <Music className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">No Song Loaded</p>
                <p className="text-sm">Change your Workout Type or check your connection status.</p>
              </div>
            )}

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
                      currentSong?.id === song.id ? 'bg-green-600 shadow-lg' : 'bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="flex items-center justify-center w-8">
                        {currentSong?.id === song.id ? (
                          <div className="flex space-x-0.5">
                            <div className="w-1 bg-white h-4 animate-pulse"></div>
                            <div className="w-1 bg-white h-3 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-1 bg-white h-5 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">{idx + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-white">{song.name}</p>
                        <p className={`text-xs truncate ${currentSong?.id === song.id ? 'text-green-100' : 'text-gray-400'}`}>{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-semibold ${currentSong?.id === song.id ? 'text-white' : 'text-green-400'}`}>
                        {song.bpm} BPM
                      </span>
                      {currentSong?.id === song.id && <Music className="w-4 h-4 text-white animate-pulse" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column: Workout selection + How it works */}
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
                      <div className={`text-xs ${selectedWorkout === workout.id ? 'text-white/80' : 'text-gray-400'}`}>{workout.range}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 text-sm">How it works</h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                As your heart rate changes during your workout, the app automatically queues songs that match your current BPM,
                keeping you in the zone. Connect a Spotify token in Settings to use live recommendations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
