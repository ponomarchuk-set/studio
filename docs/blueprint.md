# **App Name**: StudyHub

## Core Features:

- User Profile Management: Implement profile creation and editing for users, allowing them to add and modify information in predefined categories.
- Value Definition: Enable users to define and rank their life values, with a constraint that the total sum of importance does not exceed 100.
- AI-Powered Content Relevance: AI tool to sort the Chat and Voting topics by relevance for every user, based on the data in their profile.

## Style Guidelines:

- Primary color: Light gray (#F5F5F5) for a clean and modern background.
- Secondary color: Dark blue (#303F9F) for headers and important text.
- Accent: Teal (#009688) to highlight interactive elements and calls to action.
- Use a card-based layout to organize information and improve readability.
- Employ a consistent set of icons for navigation and actions.

## Original User Request:
I'd like to build a studying web app hosted on Firebase for free. 

const firebaseConfig = {
  apiKey: "AIzaSyBR6hXHteLmIIuAeYyZdbiv6eVZt4CSBrI",
  authDomain: "isr-firebase-3f5f3.firebaseapp.com",
  projectId: "isr-firebase-3f5f3",
  storageBucket: "isr-firebase-3f5f3.firebasestorage.app",
  messagingSenderId: "829118730970",
  appId: "1:829118730970:web:bb4cbad592fd98a05ecbe3",
  measurementId: "G-K4HXNG30QN"
};

It should provide access to parts: Profile, Values, Chat, Voting, Tasks, Settings to a group of users. 
Logging users in with just email and password.
Profile. Every user can add and edit and store (in Firestore) some information about himself (as name: string value pairs) in its Profile in the next blocks: Demographics, Geography, Social relations, Features, Skills, Contacts. 
Values. Every user fills out its own life values with relative marks of importance (name: integer value), the sum of all Values cannot be more than 100.
Chat is a basic usual forum like messages. Any user can create a topic (name topic, text) or comment on some message (just text). 
Voting. Any user can create a voting (it is like a chat topic, but with options other users should choose) or vote for some already created voting. Voting weight of every user is calculated based on the user's relevance to the case and his skillset.
Tasks. It is a basic tasktracker with the ability to rate each task.
In Chat, Voting and Task parts AI should sort topics by relevance for every user (based on its Profile data).
Settings is empty for now.
  