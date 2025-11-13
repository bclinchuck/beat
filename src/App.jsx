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
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import SpotifyTrackProvider from "./providers/SpotifyTrackProvider.js";

// ----------------------------------------------------------------------
// SPOTIFY OAUTH CONSTANTS
// ----------------------------------------------------------------------
const AUTH_STORAGE_KEY = 'beat_spotify_auth';
const LOOPBACK_REDIRECT = 'http://127.0.0.1:3000/';
const DEFAULT_REDIRECT = (() => {
  if (process.env.REACT_APP_SPOTIFY_REDIRECT_URI) {
    return process.env.REACT_APP_SPOTIFY_REDIRECT_URI;
  }
  if (typeof window === 'undefined') {
    return LOOPBACK_REDIRECT;
  }
  const { protocol, port } = window.location;
  const normalizedPort = port ? `:${port}` : ':3000';
  return `${protocol}//127.0.0.1${normalizedPort}/`;
})();
const SPOTIFY_CLIENT_ID =
  process.env.REACT_APP_SPOTIFY_CLIENT_ID || '70177f436adc418f98f6626d92667dde';
const SPOTIFY_REDIRECT_URI = DEFAULT_REDIRECT;
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
].join(' ');
// ----------------------------------------------------------------------

// Basic Email Regex for client-side validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Utility function to format milliseconds into M:SS string
const DEFAULT_PROFILE_IMAGE =
  'https://via.placeholder.com/150/9333ea/FFFFFF?text=P';
const DEMO_USER_STORAGE_KEY = 'beat_demo_user';
const DEMO_SESSION_KEY = 'beat_demo_session';

const formatTime = (ms) => {
  if (ms === null || isNaN(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatBpm = (bpm) =>
  typeof bpm === 'number' && !Number.isNaN(bpm) && bpm > 0
    ? `${Math.round(bpm)} BPM`
    : 'BPM n/a';

const getDurationMs = (song) => {
  if (!song || typeof song.durationMs !== 'number' || song.durationMs <= 0) {
    return 210000; // fallback to 3.5 minutes if missing
  }
  return song.durationMs;
};

const loadStoredSpotifyAuth = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistSpotifyAuth = (payload) => {
  if (typeof window === 'undefined') return;
  if (!payload) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
};

const loadDemoAuthUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistDemoAuthUser = (user) => {
  if (typeof window === 'undefined') return;
  if (!user) {
    window.localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(user));
};

const loadDemoSessionFlag = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DEMO_SESSION_KEY) === 'true';
};

const setDemoSessionFlag = (value) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    return;
  }
  window.localStorage.setItem(DEMO_SESSION_KEY, 'true');
};

const createDefaultDemoUser = () => ({
  name: 'Demo User',
  username: 'demo',
  email: 'demo@example.com',
  password: 'demo123',
  profilePicture: DEFAULT_PROFILE_IMAGE,
});

const generateRandomString = (length = 64) => {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const base64UrlEncode = (arrayBuffer) => {
  let string = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    string += String.fromCharCode(bytes[i]);
  }
  return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const createCodeChallenge = async (verifier) => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
};

export default function App() {
  const [heartRate, setHeartRate] = useState(72);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selectedWorkout, setSelectedWorkout] = useState('cardio');
  const [showSetup, setShowSetup] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(() => {
    const stored = loadStoredSpotifyAuth();
    return stored?.accessToken ?? null;
  });
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState(() => {
    const stored = loadStoredSpotifyAuth();
    return stored?.refreshToken ?? null;
  });
  const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState(() => {
    const stored = loadStoredSpotifyAuth();
    return stored?.expiresAt ?? null;
  });
  const [spotifyAuthInFlight, setSpotifyAuthInFlight] = useState(false);
  const [spotifyError, setSpotifyError] = useState(null);
  const [isFetchingTracks, setIsFetchingTracks] = useState(false);
  const [trackError, setTrackError] = useState(null);

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
  const [profilePictureUrl, setProfilePictureUrl] = useState(() => {
    const storedDemoUser = loadDemoAuthUser();
    return storedDemoUser?.profilePicture || DEFAULT_PROFILE_IMAGE;
  });
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
  const [loginError, setLoginError] = useState('');
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [demoUser, setDemoUser] = useState(() => loadDemoAuthUser());
  const isDemoAuthMode = !isFirebaseConfigured;
  const [hasDemoSession, setHasDemoSession] = useState(() =>
    loadDemoSessionFlag()
  );

  useEffect(() => {
    if (!isDemoAuthMode) return;
    persistDemoAuthUser(demoUser);
  }, [demoUser, isDemoAuthMode]);

  const ensureDemoUser = useCallback(() => {
    if (demoUser) return demoUser;
    const defaultUser = createDefaultDemoUser();
    setDemoUser(defaultUser);
    return defaultUser;
  }, [demoUser]);

  useEffect(() => {
    if (!isDemoAuthMode) return;
    setDemoSessionFlag(hasDemoSession);
  }, [hasDemoSession, isDemoAuthMode]);

  const disconnectSpotify = useCallback(() => {
    setSpotifyToken(null);
    setSpotifyRefreshToken(null);
    setSpotifyTokenExpiresAt(null);
    setSpotifyError(null);
    setTrackError(null);
  }, []);

  const refreshSpotifyAccessToken = useCallback(
    async (refreshToken) => {
      if (
        !refreshToken ||
        !SPOTIFY_CLIENT_ID ||
        SPOTIFY_CLIENT_ID.includes('YOUR_SPOTIFY_CLIENT_ID')
      ) {
        return null;
      }
      try {
        const body = new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        });

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Unable to refresh Spotify token.');
        }

        const data = await response.json();
        setSpotifyToken(data.access_token);
        setSpotifyTokenExpiresAt(
          Date.now() + ((data.expires_in ?? 3600) * 1000)
        );
        if (data.refresh_token) {
          setSpotifyRefreshToken(data.refresh_token);
        }
        setSpotifyError(null);
        return data.access_token;
      } catch (error) {
        setSpotifyError('Spotify session expired. Please reconnect.');
        disconnectSpotify();
        return null;
      }
    },
    [disconnectSpotify]
  );

  const exchangeSpotifyCodeForToken = useCallback(
    async (authorizationCode) => {
      if (
        !SPOTIFY_CLIENT_ID ||
        SPOTIFY_CLIENT_ID.includes('YOUR_SPOTIFY_CLIENT_ID')
      ) {
        setSpotifyError(
          'Set REACT_APP_SPOTIFY_CLIENT_ID before connecting to Spotify.'
        );
        return;
      }

      const verifier = sessionStorage.getItem('beat_spotify_code_verifier');
      if (!verifier) {
        setSpotifyError('Missing PKCE verifier. Start the login again.');
        return;
      }

      setSpotifyAuthInFlight(true);

      try {
        const body = new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier,
        });

        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Unable to complete Spotify sign-in.');
        }

        const data = await response.json();
        setSpotifyToken(data.access_token);
        setSpotifyTokenExpiresAt(
          Date.now() + ((data.expires_in ?? 3600) * 1000)
        );
        if (data.refresh_token) {
          setSpotifyRefreshToken(data.refresh_token);
        }
        setIsConnected(true);
        setShowSetup(false);
        setSpotifyError(null);
      } catch (error) {
        setSpotifyError(error.message || 'Unable to complete Spotify sign-in.');
      } finally {
        setSpotifyAuthInFlight(false);
        sessionStorage.removeItem('beat_spotify_code_verifier');
        sessionStorage.removeItem('beat_spotify_auth_state');
      }
    },
    [setIsConnected, setShowSetup]
  );

  useEffect(() => {
    if (!spotifyToken) {
      persistSpotifyAuth(null);
      return;
    }
    persistSpotifyAuth({
      accessToken: spotifyToken,
      refreshToken: spotifyRefreshToken,
      expiresAt: spotifyTokenExpiresAt,
    });
  }, [spotifyToken, spotifyRefreshToken, spotifyTokenExpiresAt]);

  useEffect(() => {
    if (!spotifyToken || !spotifyTokenExpiresAt) return;

    const msUntilExpiry = spotifyTokenExpiresAt - Date.now();

    if (msUntilExpiry <= 0) {
      if (spotifyRefreshToken) {
        refreshSpotifyAccessToken(spotifyRefreshToken);
      } else {
        disconnectSpotify();
      }
      return;
    }

    if (!spotifyRefreshToken) return;

    const timeoutId = setTimeout(() => {
      refreshSpotifyAccessToken(spotifyRefreshToken);
    }, Math.max(1000, msUntilExpiry - 60000)); // refresh one minute early

    return () => clearTimeout(timeoutId);
  }, [
    spotifyToken,
    spotifyTokenExpiresAt,
    spotifyRefreshToken,
    refreshSpotifyAccessToken,
    disconnectSpotify,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const authError = params.get('error');
    const stateParam = params.get('state');
    const storedState = sessionStorage.getItem('beat_spotify_auth_state');

    if (!code && !authError) return;

    if (authError) {
      setSpotifyError(`Spotify authorization failed: ${authError}`);
      setSpotifyAuthInFlight(false);
    } else if (code) {
      if (storedState && stateParam !== storedState) {
        setSpotifyError('Spotify authorization state mismatch. Please try again.');
        sessionStorage.removeItem('beat_spotify_code_verifier');
        sessionStorage.removeItem('beat_spotify_auth_state');
      } else {
        exchangeSpotifyCodeForToken(code);
      }
    }

    params.delete('code');
    params.delete('state');
    params.delete('error');
    const newQuery = params.toString();
    const newUrl = `${window.location.pathname}${
      newQuery ? `?${newQuery}` : ''
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }, [exchangeSpotifyCodeForToken]);



  const workoutTypes = [
    {
      id: 'cardio',
      name: 'Cardio',
      icon: '🏃',
      color: 'bg-red-500',
      range: '120-160 BPM',
    },
    {
      id: 'strength',
      name: 'Strength Training',
      icon: '💪',
      color: 'bg-blue-500',
      range: '90-120 BPM',
    },
    {
      id: 'yoga',
      name: 'Yoga/Stretching',
      icon: '🧘',
      color: 'bg-purple-500',
      range: '60-90 BPM',
    },
    {
      id: 'hiit',
      name: 'HIIT',
      icon: '🔥',
      color: 'bg-orange-500',
      range: '140-180 BPM',
    },
    {
      id: 'warmup',
      name: 'Warm Up',
      icon: '🌅',
      color: 'bg-yellow-500',
      range: '80-100 BPM',
    },
    {
      id: 'cooldown',
      name: 'Cool Down',
      icon: '❄️',
      color: 'bg-cyan-500',
      range: '60-80 BPM',
    },
  ];

  // 1. Heart Rate Simulation (unchanged)
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

  // Mock Song Database - UPDATED with realistic durationMs
  const getMockSongsForBPM = (bpm, workout) => {
    const songs = [
      // Duration in MS: 3:48
      {
        id: 1,
        name: 'Electric Feel',
        artist: 'MGMT',
        bpm: 112,
        workout: 'cardio',
        durationMs: 228000,
      },
      // Duration in MS: 4:30
      {
        id: 2,
        name: 'Uptown Funk',
        artist: 'Bruno Mars',
        bpm: 115,
        workout: 'cardio',
        durationMs: 270000,
      },
      // Duration in MS: 4:07
      {
        id: 3,
        name: 'Stronger',
        artist: 'Kanye West',
        bpm: 104,
        workout: 'strength',
        durationMs: 247000,
      },
      // Duration in MS: 4:05
      {
        id: 4,
        name: 'Eye of the Tiger',
        artist: 'Survivor',
        bpm: 109,
        workout: 'strength',
        durationMs: 245000,
      },
      // Duration in MS: 4:26
      {
        id: 5,
        name: 'Breathe',
        artist: 'Telepopmusik',
        bpm: 72,
        workout: 'yoga',
        durationMs: 266000,
      },
      // Duration in MS: 10:25 (Longer for yoga)
      {
        id: 6,
        name: 'Weightless',
        artist: 'Marconi Union',
        bpm: 60,
        workout: 'yoga',
        durationMs: 625000,
      },
      // Duration in MS: 4:28
      {
        id: 7,
        name: 'Till I Collapse',
        artist: 'Eminem',
        bpm: 171,
        workout: 'hiit',
        durationMs: 268000,
      },
      // Duration in MS: 4:52
      {
        id: 8,
        name: 'Thunderstruck',
        artist: 'AC/DC',
        bpm: 133,
        workout: 'hiit',
        durationMs: 292000,
      },
      // Duration in MS: 4:29
      {
        id: 9,
        name: 'Cannot Stop',
        artist: 'Red Hot Chili Peppers',
        bpm: 118,
        workout: 'cardio',
        durationMs: 269000,
      },
      // Duration in MS: 5:26
      {
        id: 10,
        name: 'Lose Yourself',
        artist: 'Eminem',
        bpm: 171,
        workout: 'hiit',
        durationMs: 326000,
      },
      // Duration in MS: 3:39
      {
        id: 11,
        name: 'Work',
        artist: 'Rihanna',
        bpm: 92,
        workout: 'strength',
        durationMs: 219000,
      },
      // Duration in MS: 2:41
      {
        id: 12,
        name: 'Sunflower',
        artist: 'Post Malone',
        bpm: 90,
        workout: 'warmup',
        durationMs: 161000,
      },
      // Duration in MS: 3:23
      {
        id: 13,
        name: 'Levitating',
        artist: 'Dua Lipa',
        bpm: 103,
        workout: 'cardio',
        durationMs: 203000,
      },
      // Duration in MS: 3:20
      {
        id: 14,
        name: 'Blinding Lights',
        artist: 'The Weeknd',
        bpm: 171,
        workout: 'cardio',
        durationMs: 200000,
      },
      // Duration in MS: 3:36
      {
        id: 15,
        name: 'Do Not Stop Me Now',
        artist: 'Queen',
        bpm: 156,
        workout: 'cardio',
        durationMs: 216000,
      },
      // Duration in MS: 3:38
      {
        id: 16,
        name: 'Shallow',
        artist: 'Lady Gaga',
        bpm: 96,
        workout: 'warmup',
        durationMs: 218000,
      },
      // Duration in MS: 4:32
      {
        id: 17,
        name: 'Say Something',
        artist: 'A Great Big World',
        bpm: 72,
        workout: 'yoga',
        durationMs: 272000,
      },
      // Duration in MS: 5:09
      {
        id: 18,
        name: 'The Scientist',
        artist: 'Coldplay',
        bpm: 73,
        workout: 'cooldown',
        durationMs: 309000,
      },
      // Duration in MS: 4:55
      {
        id: 19,
        name: 'Fix You',
        artist: 'Coldplay',
        bpm: 68,
        workout: 'cooldown',
        durationMs: 295000,
      },
      // Duration in MS: 3:21
      {
        id: 20,
        name: 'Skinny Love',
        artist: 'Bon Iver',
        bpm: 75,
        workout: 'yoga',
        durationMs: 201000,
      },
      // Duration in MS: 4:05
      {
        id: 21,
        name: 'Gravity',
        artist: 'John Mayer',
        bpm: 70,
        workout: 'cooldown',
        durationMs: 245000,
      },
      // Duration in MS: 6:53
      {
        id: 22,
        name: 'Hallelujah',
        artist: 'Jeff Buckley',
        bpm: 68,
        workout: 'yoga',
        durationMs: 413000,
      },
      // Duration in MS: 3:05
      {
        id: 23,
        name: 'Mad World',
        artist: 'Gary Jules',
        bpm: 82,
        workout: 'cooldown',
        durationMs: 185000,
      },
      // Duration in MS: 4:27
      {
        id: 24,
        name: 'Chasing Cars',
        artist: 'Snow Patrol',
        bpm: 76,
        workout: 'cooldown',
        durationMs: 267000,
      },
      // Duration in MS: 3:13
      {
        id: 25,
        name: 'Physical',
        artist: 'Dua Lipa',
        bpm: 147,
        workout: 'hiit',
        durationMs: 193000,
      },
      // Duration in MS: 3:45
      {
        id: 26,
        name: 'Higher Love',
        artist: 'Kygo, Whitney Houston',
        bpm: 104,
        workout: 'cardio',
        durationMs: 225000,
      },
      // Duration in MS: 2:37
      {
        id: 27,
        name: 'Old Town Road',
        artist: 'Lil Nas X',
        bpm: 136,
        workout: 'strength',
        durationMs: 157000,
      },
      // Duration in MS: 3:52
      {
        id: 28,
        name: 'Sweet Caroline',
        artist: 'Neil Diamond',
        bpm: 125,
        workout: 'warmup',
        durationMs: 232000,
      },
      // Duration in MS: 3:55
      {
        id: 29,
        name: 'Strawberry Swing',
        artist: 'Coldplay',
        bpm: 90,
        workout: 'yoga',
        durationMs: 235000,
      },
      // Duration in MS: 2:54
      {
        id: 30,
        name: 'One Dance',
        artist: 'Drake',
        bpm: 104,
        workout: 'strength',
        durationMs: 174000,
      },
    ];

    const workoutSongs = songs.filter((s) => s.workout === workout);

    // Filter songs that are within +/- 20 BPM of the current heart rate
    return workoutSongs
      .filter((song) => Math.abs(song.bpm - bpm) <= 20)
      .map((song) => ({ ...song, bpmDiff: Math.abs(song.bpm - bpm) }))
      .sort((a, b) => a.bpmDiff - b.bpmDiff) // Sort by closest BPM match
      .slice(0, 8); // Only show the top 8 matches
  };

  const skipSong = useCallback(() => {
    setQueue((prevQueue) => {
      if (!currentSong) return prevQueue;

      const nextIndex = prevQueue.findIndex((s) => s.id === currentSong.id) + 1;

      if (nextIndex < prevQueue.length) {
        setCurrentSong(prevQueue[nextIndex]);
        return prevQueue;
      } else if (prevQueue.length > 0) {
        // Loop back to the first song if end of list is reached
        setCurrentSong(prevQueue[0]);
        return prevQueue;
      } else {
        setCurrentSong(null);
        return prevQueue;
      }
    });
  }, [currentSong]);

  // Reset playback time when a new song is set
  useEffect(() => {
    if (currentSong) {
      setCurrentPlaybackTime(0);
      // Ensure player starts if a song is set
      if (!isPlaying) {
        setIsPlaying(true);
      }
    }
  }, [currentSong]);

  // Real-time Playback Timer and Auto-Skip
  useEffect(() => {
    // Only run if playing and a song is loaded
    if (!isPlaying || !currentSong) {
      return;
    }

    const trackDuration = getDurationMs(currentSong);

    const interval = setInterval(() => {
      setCurrentPlaybackTime((prev) => {
        const newTime = prev + 1000;
        // Check if song is over
        if (newTime >= trackDuration) {
          // Time is up, skip to next song
          skipSong();
          return 0; // The next useEffect handles the reset to 0 for the new song
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentSong, skipSong]);

  // 2. LIVE QUEUEING MECHANISM (Triggers when heartRate changes)
  useEffect(() => {
    if (!isConnected) {
      setQueue([]);
      setCurrentSong(null);
      setTrackError(null);
      setIsFetchingTracks(false);
      return;
    }

    if (!spotifyToken) {
      const songsForBPM = getMockSongsForBPM(heartRate, selectedWorkout);

      if (songsForBPM.length === 0) {
        setQueue([]);
        setCurrentSong(null);
        setTrackError(
          'No demo tracks found for this workout/BPM. Connect Spotify for live music.'
        );
        return;
      }

      setTrackError(null);
      setIsFetchingTracks(false);
      setQueue(songsForBPM);
      setCurrentSong((prev) => {
        if (prev && songsForBPM.some((song) => song.id === prev.id)) {
          return prev;
        }
        if (isPlaying || !prev) {
          return songsForBPM[0];
        }
        return prev;
      });
      return;
    }

    let cancelled = false;
    const provider = new SpotifyTrackProvider(spotifyToken);

    const fetchRecommendations = async () => {
      setIsFetchingTracks(true);
      setTrackError(null);
      try {
        const tracks = await provider.getRecommendations(
          heartRate,
          selectedWorkout
        );
        if (cancelled) return;

        setQueue(tracks);
        setCurrentSong((prev) => {
          if (!tracks.length) return null;
          if (prev && tracks.some((song) => song.id === prev.id)) {
            return prev;
          }
          if (isPlaying || !prev) {
            return tracks[0];
          }
          return prev;
        });
      } catch (error) {
        if (cancelled) return;
        const friendly =
          error?.message?.startsWith('Spotify 404')
            ? 'Spotify did not return any recommendations for this combo yet. Try another workout or reconnect.'
            : error?.message || 'Unable to load Spotify recommendations.';
        setTrackError(friendly);
        setQueue([]);
        setCurrentSong(null);
      } finally {
        if (!cancelled) {
          setIsFetchingTracks(false);
        }
      }
    };

    fetchRecommendations();

    return () => {
      cancelled = true;
    };
  }, [
    heartRate,
    selectedWorkout,
    isConnected,
    spotifyToken,
    isPlaying,
  ]);

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
    setCurrentPlaybackTime(
      Math.max(0, Math.min(currentSong.durationMs, newTimeMs))
    );

    // Ensure playback restarts immediately if it was paused
    if (!isPlaying) {
      setIsPlaying(true);
    }
  };

  // Authentication Handlers

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); // Clear previous errors

    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError('Please enter a username/email and password');
      return;
    }

    if (isDemoAuthMode) {
      const localUser = ensureDemoUser();
      const identifier = loginIdentifier.trim().toLowerCase();
      const matchesEmail =
        localUser.email?.toLowerCase() === identifier;
      const matchesUsername =
        localUser.username?.toLowerCase() === identifier;

      if (!matchesEmail && !matchesUsername) {
        setLoginError('Username or email not found.');
        return;
      }

      if (localUser.password !== loginPassword) {
        setLoginError('Incorrect password. Please try again.');
        return;
      }

      setUserProfile({
        name: localUser.name,
        username: localUser.username,
        email: localUser.email,
        profilePicture: localUser.profilePicture,
      });
      setProfilePictureUrl(
        localUser.profilePicture || DEFAULT_PROFILE_IMAGE
      );
      setIsAuthenticated(true);
      setIsConnected(true);
      setIsPlaying(true);
      setHasDemoSession(true);
      return;
    }

    try {
      let email = loginIdentifier;

      if (!loginIdentifier.includes('@')) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', loginIdentifier));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setLoginError('Username not found');
          return;
        }

        email = querySnapshot.docs[0].data().email;
      }

      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        loginPassword
      );

      if (!userCred.user.emailVerified) {
        await sendEmailVerification(userCred.user);
        setLoginError(
          'Please verify your email before logging in. Verification email resent!'
        );
        return;
      }

      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData =
        userDocSnap && userDocSnap.exists() ? userDocSnap.data() : null;

      if (userData) {
        setUserProfile(userData);
        setProfilePictureUrl(userData.profilePicture || DEFAULT_PROFILE_IMAGE);
      } else {
        setUserProfile({ email: userCred.user.email });
        setProfilePictureUrl(DEFAULT_PROFILE_IMAGE);
      }

      setIsAuthenticated(true);
      setIsConnected(true);
      setIsPlaying(true);
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        setLoginError(
          'Too many failed attempts. Please wait a few minutes before trying again.'
        );
      } else if (error.code === 'auth/user-not-found') {
        setLoginError('Username or email not found.');
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-credential') {
        setLoginError('Incorrect password. Please try again.');
      } else {
        setLoginError(error.message);
      }
    }
  };








  const handleSignUp = async () => {
    setSignupError(""); // clear previous errors

    if (
      !signupName.trim() ||
      !signupUsername.trim() ||
      !signupEmail.trim() ||
      !signupPassword.trim() ||
      !signupConfirmPassword.trim()
    ) {
      setSignupError("Please fill in all fields.");
      return;
    }

    if (!EMAIL_REGEX.test(signupEmail)) {
      setSignupError("Please enter a valid email address.");
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setSignupError("Passwords do not match!");
      return;
    }

    try {
      if (isDemoAuthMode) {
        const emailLower = signupEmail.toLowerCase();
        const usernameLower = signupUsername.toLowerCase();
        if (
          demoUser &&
          (demoUser.email?.toLowerCase() === emailLower ||
            demoUser.username?.toLowerCase() === usernameLower)
        ) {
          setSignupError("An account already exists in local demo mode. Try logging in.");
          return;
        }

        const newUser = {
          name: signupName,
          username: signupUsername,
          email: signupEmail,
          password: signupPassword,
          profilePicture: DEFAULT_PROFILE_IMAGE,
        };

        setDemoUser(newUser);
        setSignupError("Local account created! Sign in to continue.");
        setSignupName("");
        setSignupUsername("");
        setSignupEmail("");
        setSignupPassword("");
        setSignupConfirmPassword("");
        setIsSignUp(false);
        setShowLogin(true);
        return;
      }

      // ✅ Create account in Firebase Auth
      const userCred = await createUserWithEmailAndPassword(
        auth,
        signupEmail,
        signupPassword
      );

      // ✅ Send verification email
      await sendEmailVerification(userCred.user);

      // ❌ Don't log in yet
      await signOut(auth); // make sure user is signed out until verified

      // ✅ Save username + name in Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        name: signupName,
        username: signupUsername,
        email: signupEmail,
      });

      // ✅ Show in-app message instead of alert
      setSignupError("Verification email sent! Please check your inbox before logging in.");

      // Optionally, clear signup fields
      setSignupName("");
      setSignupUsername("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupConfirmPassword("");

    } catch (error) {
      setSignupError(error.message); // still shows errors in red box
    }
  };




  // Handlers for Forgot/Reset Flows (omitted for brevity, unchanged)
  const handleForgotUsername = () => {
    setForgotError('');
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setEmailSentMessage(
      `An email with your username has been sent to ${forgotEmail}.`
    );
    setShowEmailSent(true);
    setShowForgotUsername(false);
  };

  const handleForgotPassword = () => {
    setForgotError('');
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }
    setEmailSentMessage(
      `A password reset link has been sent to ${forgotEmail}.`
    );
    setShowEmailSent(true);
    setShowForgotPassword(false);
  };

  const handleLogout = () => {
    disconnectSpotify();
    setIsAuthenticated(false);
    setUserProfile(null);
    setIsConnected(false);
    setShowSetup(false);
    setShowProfileSettings(false);
    setProfilePictureUrl(
      DEFAULT_PROFILE_IMAGE
    );
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
    setHasDemoSession(false);
  };

  const handleProfilePictureChange = async (newUrl) => {
    const finalUrl = newUrl || DEFAULT_PROFILE_IMAGE;
    const completeUpdate = () => {
      setProfilePictureUrl(finalUrl);
      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              profilePicture: finalUrl,
            }
          : prev
      );
      setProfileUpdateSuccess(true);
      setTimeout(() => {
        setShowProfileSettings(false);
        setProfileUpdateSuccess(false);
      }, 2000);
    };

    if (isDemoAuthMode) {
      setDemoUser((prev) =>
        prev
          ? {
              ...prev,
              profilePicture: finalUrl,
            }
          : prev
      );
      completeUpdate();
      return;
    }

    try {
      if (!auth?.currentUser) {
        console.error('No user logged in!');
        return;
      }

      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, { profilePicture: finalUrl });
      completeUpdate();
    } catch (error) {
      console.error('Error updating profile picture:', error.message);
      alert('Error saving profile picture: ' + error.message);
    }
  };


  const initiateSpotifyAuth = useCallback(async () => {
    setSpotifyError(null);

    if (
      !SPOTIFY_CLIENT_ID ||
      SPOTIFY_CLIENT_ID.includes('YOUR_SPOTIFY_CLIENT_ID')
    ) {
      setSpotifyError(
        'Set REACT_APP_SPOTIFY_CLIENT_ID before connecting to Spotify.'
      );
      return;
    }

    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      setSpotifyError(
        'This device does not support the Web Crypto APIs required for Spotify login.'
      );
      return;
    }

    try {
      setSpotifyAuthInFlight(true);
      const verifier = generateRandomString(64);
      const challenge = await createCodeChallenge(verifier);
      const state = generateRandomString(16);

      sessionStorage.setItem('beat_spotify_code_verifier', verifier);
      sessionStorage.setItem('beat_spotify_auth_state', state);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state,
      });

      window.location.assign(
        `https://accounts.spotify.com/authorize?${params.toString()}`
      );
    } catch (error) {
      console.error('Spotify auth error:', error);
      setSpotifyAuthInFlight(false);
      setSpotifyError(
        error?.message || 'Unable to start Spotify authorization.'
      );
    }
  }, []);

  // Legacy helper (kept for backward compatibility)
  const handleProfilePictureSave = async () => {
    handleProfilePictureChange(profilePictureUrl);
  };

  const continueInDemoMode = () => {
    if (!isDemoAuthMode) return;
    const user = ensureDemoUser();
    setUserProfile({
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
    });
    setProfilePictureUrl(user.profilePicture || DEFAULT_PROFILE_IMAGE);
    setIsAuthenticated(true);
    setIsConnected(true);
    setIsPlaying(true);
    setShowLogin(false);
    setIsSignUp(false);
    setShowForgotUsername(false);
    setShowForgotPassword(false);
    setShowEmailSent(false);
    setLoginError('');
    setSignupError('');
    setHasDemoSession(true);
  };


  const togglePlayback = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    // If starting playback and no song is loaded, load the first queue song
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

  // Profile Settings Modal Component (omitted for brevity, unchanged)
  const ProfileSettingsModal = () => {
    const [tempUrl, setTempUrl] = useState(profilePictureUrl || '');

    useEffect(() => {
      if (showProfileSettings) {
        setTempUrl(profilePictureUrl || '');
      }
    }, [showProfileSettings]);

    const handleSave = () => {
      handleProfilePictureChange(tempUrl);
    };

    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
        {profileUpdateSuccess && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out">
            Profile picture updated successfully!
          </div>
        )}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>

          <div className="flex flex-col items-center mb-6">
            <img
              src={tempUrl || DEFAULT_PROFILE_IMAGE}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-purple-500 shadow-xl"
            />
            {/* File input logic omitted for brevity */}
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="Enter new image URL"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Save Picture
            </button>
            <button
              onClick={() => {
                setShowProfileSettings(false);
                setProfileUpdateSuccess(false);
              }}
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

  useEffect(() => {
    if (!isDemoAuthMode || isAuthenticated || !hasDemoSession) return;
    continueInDemoMode();
  }, [isDemoAuthMode, isAuthenticated, hasDemoSession]);

  // --- Authentication UI ---
  if (!isAuthenticated) {
    // ... [Authentication UI Code Here - Unchanged from previous step] ...
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-4 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <Heart
                    className="w-12 h-12 text-red-500"
                    fill="currentColor"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Beat</h1>
              <p className="text-gray-400">
                Your music, synced to your heartbeat
              </p>
            </div>

            {showForgotUsername && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">
                  Recover Username
                </h2>
                <p className="text-gray-400 mb-4">
                  Enter your email address and we'll send you your username.
                </p>
                {forgotError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {forgotError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotError('');
                        }}
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
                    onClick={() => {
                      setShowForgotUsername(false);
                      setShowLogin(true);
                      setForgotEmail('');
                      setForgotError('');
                    }}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 inline-block mr-2" /> Back to
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {showForgotPassword && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">
                  Reset Password
                </h2>
                <p className="text-gray-400 mb-4">
                  Enter your email address and we'll send you a reset link.
                </p>
                {forgotError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {forgotError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotError('');
                        }}
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
                    onClick={() => {
                      setShowForgotPassword(false);
                      setShowLogin(true);
                      setForgotEmail('');
                      setForgotError('');
                    }}
                    className="text-purple-400 hover:text-purple-300 font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 inline-block mr-2" /> Back to
                    Sign In
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
                  onClick={() => {
                    setShowEmailSent(false);
                    setShowLogin(true);
                    setForgotEmail('');
                    setForgotError('');
                  }}
                  className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 transition-all"
                >
                  OK
                </button>
              </div>
            )}

            {showLogin &&
              !isSignUp &&
              !showForgotUsername &&
              !showForgotPassword &&
              !showEmailSent && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">
                    Sign In
                  </h2>
                  {isDemoAuthMode && (
                    <div className="bg-blue-900/40 border border-blue-500 text-blue-100 p-3 rounded-lg mb-4 text-sm">
                      Local demo auth mode is active. Accounts you create here live only in this browser.
                    </div>
                  )}
                  {loginError && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                      {loginError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email or Username
                      </label>
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
                        onClick={() => {
                          setShowForgotUsername(true);
                          setShowLogin(false);
                        }}
                        className="text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        Forgot username?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setShowLogin(false);
                        }}
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
                    {isDemoAuthMode && (
                      <button
                        type="button"
                        onClick={continueInDemoMode}
                        className="w-full mt-3 bg-gray-700 text-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-600 transition-all"
                      >
                        Continue as guest (demo mode)
                      </button>
                    )}
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
                <h2 className="text-2xl font-bold text-white mb-6">
                  Create Account
                </h2>
                {isDemoAuthMode && (
                  <div className="bg-blue-900/40 border border-blue-500 text-blue-100 p-3 rounded-lg mb-4 text-sm">
                    This account lives only in your browser while Firebase is disconnected.
                  </div>
                )}

                {signupError && (
                  <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg mb-4 text-sm">
                    {signupError}
                  </div>
                )}

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
                      Username
                    </label>
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
                        onChange={(e) =>
                          setSignupConfirmPassword(e.target.value)
                        }
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

  // --- SPOTIFY SETUP UI (omitted for brevity, unchanged) ---
  if (showSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-2xl shadow-lg">
                  <Heart
                    className="w-12 h-12 text-red-500"
                    fill="currentColor"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Beat Setup</h1>
              <p className="text-gray-400">
                Connect your Spotify account to sync your music
              </p>
            </div>

            <div className="space-y-6">
              {spotifyError && (
                <div className="bg-red-900/40 border border-red-700 text-red-100 rounded-lg p-4 text-sm">
                  {spotifyError}
                </div>
              )}

              <div className="bg-gray-700 rounded-lg p-6 text-center space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Authorize Spotify
                  </h3>
                  <p className="text-gray-400">
                    We use Spotify&apos;s browser-based PKCE flow, so it works
                    on Firebase Hosting without a custom backend.
                  </p>
                </div>

                <button
                  onClick={initiateSpotifyAuth}
                  disabled={spotifyAuthInFlight}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    spotifyAuthInFlight
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
                  }`}
                >
                  {spotifyAuthInFlight ? 'Opening Spotify…' : 'Connect with Spotify'}
                </button>

                <p className="text-sm text-gray-400">
                  Make sure{' '}
                  <span className="text-white font-mono">
                    {SPOTIFY_REDIRECT_URI}
                  </span>{' '}
                  is added as a Redirect URI in your Spotify Developer
                  Dashboard.
                </p>
              </div>

              {spotifyToken && (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-6 text-center space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Spotify Connected
                    </h3>
                    <p className="text-green-100 text-sm">
                      Your Firebase-hosted app is linked to Spotify. Close this
                      dialog to start syncing live tracks.
                    </p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <button
                      onClick={() => setShowSetup(false)}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-500 transition-colors"
                    >
                      Back to Dashboard
                    </button>
                    <button
                      onClick={disconnectSpotify}
                      className="flex-1 bg-gray-800 border border-gray-600 text-gray-100 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                    >
                      Disconnect Spotify
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center">
                <div className="w-full border-t border-gray-700"></div>
                <span className="px-3 text-gray-500 text-sm">OR</span>
                <div className="w-full border-t border-gray-700"></div>
              </div>

              <button
                onClick={() => {
                  disconnectSpotify();
                  setIsConnected(true);
                  setShowSetup(false);
                  setIsPlaying(true);
                }}
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
        {/* Header with Profile (omitted for brevity, unchanged) */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mr-3 shadow-lg">
              <Heart className="w-8 h-8 text-red-500" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Beat</h1>
              <p className="text-gray-400 text-sm">
                {spotifyToken
                  ? 'Spotify live mode · playlists refresh with your BPM'
                  : 'Demo mode · connect Spotify to stream real recommendations'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 rounded-xl p-3 flex items-center space-x-3 border border-gray-700">
              <div
                className="w-10 h-10 rounded-full overflow-hidden cursor-pointer group relative"
                onClick={() => setShowProfileSettings(true)}
              >
                <img
                  src={profilePictureUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-white font-semibold text-sm">
                  {userProfile?.name}
                </p>
                <p className="text-gray-400 text-xs">
                  @{userProfile?.username}
                </p>
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
          <div className="md:col-span-2 bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">
                  Current Heart Rate
                </h2>
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
                  <Heart
                    className={`w-16 h-16 ${getHeartRateColor(
                      heartRate
                    )} animate-pulse`}
                  />
                </div>
              </div>
              <div className="ml-8">
                <div
                  className={`text-6xl font-bold ${getHeartRateColor(
                    heartRate
                  )}`}
                >
                  {heartRate}
                </div>
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
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                      Now Playing
                    </p>
                    <h3 className="text-white font-bold text-2xl mb-1 truncate">
                      {currentSong.name}
                    </h3>
                    <p className="text-gray-300 text-lg truncate mb-2">
                      {currentSong.artist}
                    </p>
                    <div className="flex items-center space-x-3">
                      <span className="bg-green-500/20 text-green-400 text-sm font-semibold px-3 py-1 rounded-full">
                        {formatBpm(currentSong.bpm)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar and Time Display */}
                <div className="mt-6 flex items-center space-x-4">
                  <button
                    onClick={togglePlayback}
                    className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full transition-colors shadow-lg"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6 ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={skipSong}
                    className="bg-gray-600 hover:bg-gray-500 text-white p-4 rounded-full transition-colors"
                  >
                    <SkipForward className="w-6 h-6" />
                  </button>

                  {/* Current Playback Time */}
                  <span className="text-gray-400 text-sm">
                    {formatTime(currentPlaybackTime)}
                  </span>

                  {/* Dynamic Progress Bar (Scrubbing Enabled) */}
                  <div
                    className="flex-1 bg-gray-600 h-2 rounded-full overflow-hidden cursor-pointer group"
                    onClick={handleScrub}
                  >
                    <div
                      className="bg-green-500 h-full transition-none"
                      style={{
                        width: `${
                          Math.min(
                            100,
                            (currentPlaybackTime / getDurationMs(currentSong)) *
                              100
                          )
                        }%`,
                        // Add a subtle hover effect for better scrubbing feel
                        boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                      }}
                    ></div>
                  </div>

                  {/* Total Duration Time */}
                  <span className="text-gray-400 text-sm">
                    {formatTime(currentSong.durationMs)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-xl p-6 mb-6 text-center text-gray-400 border border-gray-600">
                <Music className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">No Song Loaded</p>
                <p className="text-sm">
                  Change your Workout Type or check your connection status.
                </p>
              </div>
            )}

            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Queue (Matched to Your BPM)
              </h3>
              {spotifyToken ? (
                <p className="text-xs text-green-300 mb-3">
                  Live Spotify recommendations updating with your heart rate.
                </p>
              ) : (
                <p className="text-xs text-yellow-300 mb-3">
                  Using demo tracks. Connect Spotify for real music.
                </p>
              )}
              {isFetchingTracks && spotifyToken && (
                <div className="bg-green-900/20 border border-green-700 text-green-100 text-sm rounded-lg p-3 mb-3">
                  Syncing with Spotify&hellip;
                </div>
              )}
              {trackError && (
                <div className="bg-red-900/30 border border-red-700 text-red-100 text-sm rounded-lg p-3 mb-3">
                  {trackError}
                </div>
              )}
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
                            <div
                              className="w-1 bg-white h-3 animate-pulse"
                              style={{ animationDelay: '0.2s' }}
                            ></div>
                            <div
                              className="w-1 bg-white h-5 animate-pulse"
                              style={{ animationDelay: '0.4s' }}
                            ></div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-white">
                          {song.name}
                        </p>
                        <p
                          className={`text-xs truncate ${
                            currentSong?.id === song.id
                              ? 'text-green-100'
                              : 'text-gray-400'
                          }`}
                        >
                          {song.artist}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-semibold ${
                          currentSong?.id === song.id
                            ? 'text-white'
                            : 'text-green-400'
                        }`}
                      >
                        {formatBpm(song.bpm)}
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

          <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              Workout Type
            </h2>
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
                      <div
                        className={`text-xs ${
                          selectedWorkout === workout.id
                            ? 'text-white/80'
                            : 'text-gray-400'
                        }`}
                      >
                        {workout.range}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 bg-gray-700 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2 text-sm">
                How it works
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                As your heart rate changes during your workout, the app
                automatically queues songs that match your current BPM, keeping
                you in the zone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
