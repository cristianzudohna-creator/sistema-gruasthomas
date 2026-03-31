import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCnmnF5ZQGIchqxfJvVK9Gbg6AWEvUunlI",
  authDomain: "sistema-gruasthomas.firebaseapp.com",
  projectId: "sistema-gruasthomas",
  storageBucket: "sistema-gruasthomas.firebasestorage.app",
  messagingSenderId: "1078797549969",
  appId: "1:1078797549969:web:29805ab231872b47d3da30"
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);

export async function getFCMToken() {
  try {
    const token = await getToken(messaging, {
      vapidKey: "BMVxzIxQ_UJH6MkaROmnmLTO8PTPlqrQOUHQ7Bk6jG7-eEKJh4jX43Qtbe8DvWFFQvYyBmuPangpRsisyDYmrAI",
    });

    return token;
  } catch (error) {
    console.error("Error obteniendo token:", error);
    return null;
  }
}