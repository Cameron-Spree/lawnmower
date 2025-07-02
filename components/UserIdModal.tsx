
import React, { useState, useEffect, useRef } from 'react';
import { addDebugLog } from '../services/geminiService'; // For logging modal events

interface UserIdModalProps {
  onSubmit: (userId: string) => void;
}

const UserIdModal: React.FC<UserIdModalProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    addDebugLog("DEBUG", "UserIdModal mounted and displayed.");
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      addDebugLog("INFO", `UserIdModal submitting name: "${trimmedName}"`);
      onSubmit(trimmedName);
    } else {
      addDebugLog("WARN", "UserIdModal submit attempted with empty name.");
      // Optionally, provide feedback to the user here if desired
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md transform transition-all">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          <h2 className="mt-3 text-2xl font-semibold leading-9 text-gray-900">
            Welcome to Briants Bot!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your name or an identifier for this session. This helps us personalize your experience and track feedback.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label htmlFor="userName" className="block text-sm font-medium leading-6 text-gray-900 sr-only">
              Your Name
            </label>
            <input
              ref={inputRef}
              type="text"
              id="userName"
              name="userName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name or identifier"
              className="block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              aria-required="true"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </form>
         <p className="mt-4 text-center text-xs text-gray-500">
            Your identifier is used solely for improving this session.
        </p>
      </div>
    </div>
  );
};

export default UserIdModal;