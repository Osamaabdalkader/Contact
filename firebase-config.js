// تهيئة Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAzYZMxqNmnLMGYnCyiJYPg2MbxZMt0co0",
    authDomain: "osama-91b95.firebaseapp.com",
    databaseURL: "https://osama-91b95-default-rtdb.firebaseio.com",
    projectId: "osama-91b95",
    storageBucket: "osama-91b95.appspot.com",
    messagingSenderId: "118875905722",
    appId: "1:118875905722:web:200bff1bd99db2c1caac83",
    measurementId: "G-LEM5PVPJZC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();