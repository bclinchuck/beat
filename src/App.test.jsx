import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock Firebase
jest.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
  db: {},
  storage: {},
}));

// Mock Firebase auth functions
jest.mock('firebase/auth', () => ({
  initializeApp: jest.fn(),
  getAuth: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

// Mock Firebase firestore functions
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}));

describe('App Authentication UI Tests', () => {
  it('should render login form with email input on initial load', () => {
    render(<App />);
    
    const emailInput = screen.getByPlaceholderText('username or your@email.com');
    expect(emailInput).toBeInTheDocument();
  });

  it('should have a password input field', () => {
    render(<App />);
    
    const passwordLabel = screen.getByText('Password');
    expect(passwordLabel).toBeInTheDocument();
  });

  it('should have a sign in button', () => {
    render(<App />);
    
    const signInButton = screen.getByRole('button', { name: /sign in/i });
    expect(signInButton).toBeInTheDocument();
  });

  it('should update email input value when user types', () => {
    render(<App />);
    
    const emailInput = screen.getByPlaceholderText('username or your@email.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    expect(emailInput.value).toBe('test@example.com');
  });

  it('should update password input value when user types', () => {
    render(<App />);
    
    const passwordInput = screen.getByPlaceholderText('••••••••');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(passwordInput.value).toBe('password123');
  });

  it('should have a sign up button', () => {
    render(<App />);
    
    const signUpButton = screen.getByRole('button', { name: /sign up/i });
    expect(signUpButton).toBeInTheDocument();
  });
});
