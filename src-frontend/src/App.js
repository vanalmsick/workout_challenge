import React, {useEffect, useState} from "react";
import {useSelector, useDispatch, Provider} from 'react-redux';
import './App.css';
import { store } from './utils/store';


import {BrowserRouter as Router, Routes, Route, useLocation} from "react-router";
import {
    WelcomePage,
    RegisterPage,
    LogInPage,
    ResetPasswordPage,
    SetNewPasswordPage,
    NotFound,
    LogoutPage
} from "./pages/Public";
import MySpace from "./pages/MySpace";
import Competition from "./pages/Competition";
import {InitStravaLink, ReturnStravaLink} from "./pages/StravaLink";


function App() {
    return (
        <Router>
            <Routes>
                <Route excat path="/" element={<WelcomePage />} />
                <Route excat path="signup" element={<RegisterPage />} />
                <Route excat path="login" element={<LogInPage />} />
                <Route excat path="logout" element={<LogoutPage />} />
                <Route excat path="password" element={<ResetPasswordPage />} />
                <Route excat path="password/reset/:id/:token" element={<SetNewPasswordPage />} />

                <Route excat path="dashboard" element={<MySpace />} />
                <Route path="competition/:id" element={<Competition />} />

                <Route excat path="strava/link" element={<InitStravaLink />} />
                <Route excat path="strava/return" element={<ReturnStravaLink />} />

                {/* Add the catch-all route last */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}



export default App;
