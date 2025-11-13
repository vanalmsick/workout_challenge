import React, {useEffect, useState} from "react";
import {Link, useLocation, useNavigationType, useParams} from "react-router-dom";
import {useDispatch} from 'react-redux';
import {useNavigate} from 'react-router-dom';
import {BarLoader, MoonLoader} from "react-spinners";
import {usersApi} from '../utils/reducers/usersSlice';
import {workoutsApi} from '../utils/reducers/workoutsSlice';
import {competitionsApi} from '../utils/reducers/competitionsSlice';
import {statsApi} from '../utils/reducers/statsSlice';
import {feedApi} from '../utils/reducers/feedSlice';
import {PageWrapper} from "../utils/miscellaneous";
import {sentryError} from "../utils/reducers/baseQueryWithReauth";

function BaseHome({children}) {
    const navType = useNavigationType();
    useEffect(() => {
        if (navType === "POP") {
            document.body.classList.remove("body-no-scroll");
        }
    }, [navType]);

    return (
        <div className="relative min-h-screen bg-cover bg-center"
             style={{backgroundImage: "url('/running.webp')"}}>

            <div className="absolute inset-0 bg-black/50 z-0"></div>

            <div className="relative z-10 flex items-center justify-center min-h-screen px-0 md:px-4">
                <div className="p-8 rounded-xl shadow-lg max-w-2xl text-center text-white my-4">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6">Workout Challenge</h1>
                    <div>
                        <p className="text-l md:text-xl mb-8">
                            Compete with friends and co-workers <b>across devices</b> <small
                            className="hidden md:inline-block"> (Apple / Android / Garmin /
                            etc.) </small> <br className="hidden lg:inline-block"/>
                            using the <b>metrics you want</b> to use <small className="hidden md:inline-block"> (km /
                            minutes / kcal / # of times /
                            etc.) </small> <br className="hidden lg:inline-block"/>
                            <b>respecting your privacy</b><small className="hidden md:inline-block"> (no data is sold or
                            shared and only for the competition
                            necessary data synced with Strava)</small>
                        </p>
                    </div>

                    {children}

                </div>
            </div>
        </div>
    )

}


function useWaitForLocalStorage(key, expectedValue, interval = 500) {
    const [matched, setMatched] = useState(false);

    useEffect(() => {
        const check = () => {
            const value = localStorage.getItem(key);
            if (value === expectedValue) {
                setMatched(true);
            }
        };

        check(); // Initial check
        if (!matched) {
            const id = setInterval(() => {
                check();
            }, interval);

            return () => clearInterval(id);
        }
    }, [key, expectedValue, matched]);

    return matched;
}


function LogoutPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    console.log('Clear localStorage as new user wants to register');
    dispatch(usersApi.util.resetApiState());
    dispatch(workoutsApi.util.resetApiState());
    dispatch(competitionsApi.util.resetApiState());
    dispatch(statsApi.util.resetApiState());
    dispatch(feedApi.util.resetApiState());
    localStorage.clear();

    const matched = useWaitForLocalStorage("refresh_token", null);
    if (matched) {
        navigate("/login");
    }
    ;

    return (
        <BaseHome>
            <div className="flex justify-center">
                <LoadingForm/>
            </div>
        </BaseHome>
    )
}


function WelcomePage() {
    const location = useLocation();
    return (
        <BaseHome>
            <div>
                <Link to={`/signup/${location.search}`}
                      className="bg-sky-800 text-white shadow-2xl mx-2 px-6 py-3 rounded-full font-semibold hover:bg-sky-700 transition">
                    Create Account
                </Link>
                <Link to={`/login/${location.search}`}
                      className="bg-white text-sky-800 shadow-2xl mx-2 px-6 py-3 rounded-full font-semibold hover:bg-gray-300 transition">
                    Log In
                </Link>
            </div>
        </BaseHome>
    );
}


const waitForLocalStorage = (key, timeout = 5000) =>
    new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            const val = localStorage.getItem(key);
            if (val !== null) {
                clearInterval(interval);
                resolve(val);
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                reject(new Error('Timeout waiting for localStorage key'));
            }
        }, 100);
    });


const LoadingForm = () => {
    return (
        <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 flex items-center justify-center"
             style={{minWidth: '310px'}}>
            <BarLoader height={6} width={200}/>
        </div>
    )
}


const apiCreateAccount = async (email, first_name, last_name, gender, password) => {
    try {
        const response = await fetch((process.env.REACT_APP_BACKEND_URL || '') + '/api/user/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                first_name: first_name,
                last_name: last_name,
                gender: gender,
                password: password
            }),
        });
        
        if (response.ok) {
            console.log('Registration Success');
            return [true, undefined];
        } else {
            console.log('Registration Error:', response.status, response.statusText);
            let error_msg = 'Registration Error (' + response.status + '): ' + response.statusText + ', ';
            try {
                const error = await response.json();
                for (const key in error) {
                    error_msg += key + ': ' + error[key] + ', ';
                }
            } catch (e) {
                error_msg += ' Unknown error';
            }
            return [false, error_msg];
        }
    } catch (error) {
        console.error('Network or server error during registration:', error);
        // Capture network errors in Sentry
        sentryError({
            result: error,
            errorSource: 'manual-api',
            endpointName: 'register',
        });
        return [false, 'Network or server error occurred. Please try again.'];
    }
}

const apiLogin = async (email, password) => {
    try {
        const response = await fetch((process.env.REACT_APP_BACKEND_URL || '') + '/api/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email.toLowerCase(),
                password: password
            }),
        });

        if (response.ok) {
            console.log('Login Successful');
            const token = await response.json();
            localStorage.setItem('access_token', token.access);
            localStorage.setItem('refresh_token', token.refresh);
            return [true, undefined];
        } else {
            console.log('Login Error:', response.status, response.statusText);
            let parsedError = null;
            try {
                parsedError = await response.json();
            } catch (e) {
                parsedError = null;
            }
            return [false, response.statusText + ' (' + response.status + ') - ' + (parsedError ? parsedError.detail : 'Unknown error')];
        }
    } catch (error) {
        console.error('Network or server error during login:', error);
        // Capture network errors in Sentry
        sentryError({
            result: error,
            errorSource: 'manual-api',
            endpointName: 'login',
        });
        return [false, 'Network or server error occurred. Please try again.'];
    }
};


const apiRequestNewPassword = async (email) => {
    try {
        const response = await fetch((process.env.REACT_APP_BACKEND_URL || '') + '/api/password-reset/request/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
            }),
        });
        
        if (response.ok) {
            console.log('Password Reset Request Successful');
            return [true, undefined];
        } else {
            console.log('Password Reset Request Error:', response.status, response.statusText, response);
            let parsedError = null;
            try {
                parsedError = await response.json();
            } catch (e) {
                parsedError = null;
            }
            return [false, response.statusText + ' (' + response.status + ') - ' + (parsedError ? parsedError.detail : 'Unknown error')];
        }
    } catch (error) {
        console.error('Network or server error during password reset request:', error);
        // Capture network errors in Sentry
        sentryError({
            result: error,
            errorSource: 'manual-api',
            endpointName: 'new-password-request',
        });
        return [false, 'Network or server error occurred. Please try again.'];
    }
};


const apiSetNewPassword = async (uid, token, newPassword) => {
    try {
        const response = await fetch((process.env.REACT_APP_BACKEND_URL || '') + '/api/password-reset/confirm/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                uid: uid,
                token: token,
                new_password: newPassword,
            }),
        });
        
        if (response.ok) {
            console.log('Set New Password Successful');
            return [true, undefined];
        } else {
            console.log('Set New Password Error:', response.status, response.statusText, response);
            let parsedError = null;
            try {
                parsedError = await response.json();
            } catch (e) {
                parsedError = null;
            }
            return [false, response.statusText + ' (' + response.status + ') - ' + (parsedError ? parsedError.detail : 'Unknown error')];
        }
    } catch (error) {
        console.error('Network or server error during password reset:', error);
        // Capture network errors in Sentry
        sentryError({
            result: error,
            errorSource: 'manual-api',
            endpointName: 'set-new-password',
        });
        return [false, 'Network or server error occurred. Please try again.'];
    }
}


const apiRefreshToken = async (refreshToken) => {
    try {
        const response = await fetch((process.env.REACT_APP_BACKEND_URL || '') + '/api/token/refresh/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh: refreshToken,
            }),
        });
        
        if (response.ok) {
            console.log('Token Refresh Successful');
            const token = await response.json();
            localStorage.setItem('access_token', token.access);
            return [true, undefined];
        } else {
            console.log('Token Refresh Error:', response.status, response.statusText);
            let error = null;
            try {
                error = await response.json();
            } catch (e) {
                error = { detail: 'Unknown error' };
            }
            localStorage.removeItem('refresh_token');
            return [false, response.statusText + ' (' + response.status + ') - ' + error.detail];
        }
    } catch (error) {
        console.error('Network or server error during token refresh:', error);
        localStorage.removeItem('refresh_token');
        // Capture network errors in Sentry
        sentryError({
            result: error,
            errorSource: 'manual-api',
            endpointName: 'refresh-token',
        });
        return [false, 'Network or server error occurred during token refresh. Please try again.'];
    }
};


function RegisterPage() {

    const dispatch = useDispatch();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState([]);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        const email = e.target.email.value;
        const first_name = e.target.first_name.value;
        const last_name = e.target.last_name.value;
        const gender = e.target.gender.value;
        const password1 = e.target.password1.value;
        const password2 = e.target.password2.value;
        if (typeof (email) === "undefined" || email === null || email === "") {
            setErrorMessage(['Please enter an email address.']);
        } else if (typeof (first_name) === "undefined" || first_name === null || first_name === "") {
            setErrorMessage(['Please enter a first name.']);
        } else if (typeof (password1) === "undefined" || password1 === null || password1 === "") {
            setErrorMessage(['Please enter a password.']);
        } else if (password1 !== password2) {
            setErrorMessage(['Passwords do not match.']);
        } else {
            setIsLoading(true);
            const [success_register, msg_register] = await apiCreateAccount(email, first_name, last_name, gender, password1);
            const [success_login, msg_login] = await apiLogin(email, password1);
            const params = new URLSearchParams(location.search);
            params.set('welcome', 'true');
            if (success_register && success_login) {
                await waitForLocalStorage('access_token');
                console.log('Register and Login Successful - redirect ', localStorage.getItem('access_token'));
                navigate(`/dashboard/?${params.toString()}`);
            } else if (!success_register) {
                setErrorMessage(msg_register.split(", "));
            } else if (!success_login) {
                setErrorMessage(['Successful Registration', 'Login ' + msg_login]);
                navigate(`/dashboard/?${params.toString()}`);
            }
            setIsLoading(false);
        }
    };

    const [gender, setGender] = useState('');
    const handleDropDownChange = (e) => {
        setGender(e.target.value);
    }

    useEffect(() => {
        console.log('Clear localStorage as new user wants to register');
        dispatch(usersApi.util.resetApiState());
        dispatch(workoutsApi.util.resetApiState());
        dispatch(competitionsApi.util.resetApiState());
        dispatch(statsApi.util.resetApiState());
        dispatch(feedApi.util.resetApiState());
        localStorage.clear();
    }, []);

    return (
        <BaseHome>

            {
                isLoading ? <LoadingForm/> : (

                    <div className="flex justify-center">
                        <form className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" style={{minWidth: '310px'}}
                              onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                                    Email*
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="email" type="text" placeholder="Email" autoFocus="True" tabIndex="1"/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="first_name">
                                    First Name*
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="first_name" type="text" placeholder="First Name" tabIndex="2"/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="last_name">
                                    Last Name
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="last_name" type="text" placeholder="Last Name" tabIndex="3"/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">
                                    Gender
                                </label>
                                <select
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="gender" value={gender} tabIndex="4" onChange={handleDropDownChange}>
                                    <option value=''>--Please choose an option--</option>
                                    <option value='M'>Male</option>
                                    <option value='F'>Female</option>
                                    <option value='O'>Other</option>
                                    <option value=''>Don't want to tell</option>
                                </select>
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password1">
                                    Password*
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="password1" type="password" placeholder="******************" tabIndex="5"/>
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password2">
                                    Repeat Password*
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="password2" type="password" placeholder="******************" tabIndex="6"/>
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    className="bg-sky-800 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2 sm:mr-10"
                                    type="submit" tabIndex="7">
                                    Create Account
                                </button>
                                <Link to={`/login/${location.search}`}
                                      className="inline-block align-baseline font-bold text-sm text-sky-800 hover:text-sky-600 ml-2"
                                      tabIndex="8">
                                    Go to SignIn
                                </Link>
                            </div>
                            <p id="errors" className="text-red-500 text-xs italic mt-5">
                                {errorMessage.map((item, index) => (
                                    <span key={'error' + index}>{item}<br/></span>
                                ))}
                            </p>
                        </form>
                    </div>
                )}
        </BaseHome>
    );
}


function LogInPage() {

    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const params = new URLSearchParams(window.location.search);

    // handle submit/login action from login form
    async function handleSubmit(e) {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        const email = e.target.email.value;
        const password = e.target.password.value;
        const [success, msg] = await apiLogin(email, password);
        if (success) {
            // success logging in - redirect to dashboard
            await waitForLocalStorage('access_token');
            setIsLoading(false);
            console.log('redirect', localStorage.getItem('access_token'));
            if (params.has('redirect')) {
                const redirectUrl = decodeURIComponent(params.get('redirect'));
                console.log('Redirect to:', redirectUrl);
                navigate(redirectUrl);
            } else {
                navigate(`/dashboard/${location.search}`);
            }
        } else {
            // error logging in - user try again
            setErrorMessage(msg);
            setIsLoading(false);
        }
    }

    // check if refreshToken already exists and user is already logged in
    async function checkRefreshToken(refreshToken) {
        console.log('refresh_token already exists - check if still valid');
        setIsLoading(true);
        const [success, msg] = await apiRefreshToken(refreshToken);
        if (success) {
            // success refreshing access_token - redirecting to dashboard
            await waitForLocalStorage('access_token');
            console.log('refresh_token exists and is valid - redirect ', localStorage.getItem('access_token'));
            navigate(`/dashboard/${location.search}`);
        } else {
            // error refreshing access_token - manual login required
            localStorage.removeItem('refresh_token');
            console.log('refresh_token exists but expired - new login required');
        }
        setIsLoading(false);
    }

    useEffect(() => {
        dispatch(usersApi.util.resetApiState());
        dispatch(workoutsApi.util.resetApiState());
        dispatch(competitionsApi.util.resetApiState());
        dispatch(statsApi.util.resetApiState());
        dispatch(feedApi.util.resetApiState());

        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken !== null) {
            localStorage.removeItem('access_token');
            checkRefreshToken(refreshToken);
        }
    }, []);


    return (
        <BaseHome children={
            <div className="flex justify-center">
                {
                    isLoading ? <LoadingForm/> : (

                        <form className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" style={{minWidth: '310px'}}
                              onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                                    Email
                                </label>
                                <input
                                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="email" type="text" placeholder="Email" autoFocus="True" tabIndex="1"
                                    required={true}/>
                            </div>
                            <div className="mb-6">
                                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                                    Password
                                </label>
                                <input
                                    className="shadow appearance-none border  rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                    id="password" type="password" placeholder="******************" tabIndex="2"
                                    required={true}/>
                                <Link to={`/password/`} className="button italic text-sm text-sky-800 hover:text-sky-600"
                                      tabIndex="3">
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    className="bg-sky-800 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2 sm:mr-16"
                                    type="submit" tabIndex="4">
                                    Sign In
                                </button>
                                <Link to={`/signup/${location.search}`}
                                      className="inline-block align-baseline font-bold text-sm text-sky-800 hover:text-sky-600 ml-2"
                                      tabIndex="5">
                                    Create Account
                                </Link>
                            </div>
                            <p className="text-red-500 text-xs italic mt-5">{errorMessage}</p>
                        </form>
                    )
                }
            </div>
        }/>
    );
}


function ResetPasswordPage() {

    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // handle submit/reset action from reset password form
    async function handleSubmit(e) {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        const email = e.target.email.value;
        const [success, msg] = await apiRequestNewPassword(email);
        if (success) {
            // success reset request - redirect to start page
            window.alert('Success! Please check your email for a reset link.');
            setIsLoading(false);
            console.log('redirect to login page');
            navigate(`/`);
        } else {
            // error reset request - user try again
            setErrorMessage(msg);
            setIsLoading(false);
        }
    }

    return (
        <BaseHome children={
            <div className="flex justify-center">
                {
                    isLoading ? <LoadingForm/> : (
                    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" style={{minWidth: '310px'}}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email" autoFocus="True">
                                Email
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="email" type="text" placeholder="Email" autoFocus="True" tabIndex="1"/>
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                className="bg-sky-800 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mr-2 sm:mr-16"
                                type="submit" tabIndex="2">
                                Reset Password
                            </button>
                            <Link to="/login"
                                  className="inline-block align-baseline font-bold text-sm text-sky-800 hover:text-sky-600 ml-2"
                                  tabIndex="3">
                                Back to SignIn
                            </Link>
                        </div>
                        <p className="text-red-500 text-xs italic mt-5">{ errorMessage }</p>
                    </form>
                )}
            </div>
        }/>
    );
}


function SetNewPasswordPage() {
    const {id, token} = useParams();

    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // handle submit/reset action from reset password form
    async function handleSubmit(e) {
        e.preventDefault();
        setErrorMessage(null);
        setIsLoading(true);
        const password1 = e.target.password1.value;
        const password2 = e.target.password2.value;
        if (typeof (password1) === "undefined" || password1 === null || password1 === "") {
            setErrorMessage(['Please enter a password.']);
            setIsLoading(false);
        } else if (password1 !== password2) {
            setErrorMessage(['Passwords do not match.']);
            setIsLoading(false);
        } else {
            const [success, msg] = await apiSetNewPassword(id, token, password1);
            if (success) {
                // success reset password - redirect to login page
                setIsLoading(false);
                console.log('redirect to login page');
                navigate(`/login/`);
            } else {
                // error resetting password - user try again
                setErrorMessage(msg);
                setIsLoading(false);
            }
        }
    }

    return (
        <BaseHome children={
            <div className="flex justify-center">
                {
                    isLoading ? <LoadingForm/> : (
                    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" style={{minWidth: '45%'}}>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password1">
                                Password
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="password1" type="password" placeholder="******************" tabIndex="1" autoFocus={true}/>
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password2">
                                Repeat Password
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="password2" type="password" placeholder="******************" tabIndex="2"/>
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                className="bg-sky-800 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mx-auto sm:mx-16"
                                type="submit" tabIndex="3">
                                Reset Password
                            </button>
                        </div>
                        <p className="text-red-500 text-xs italic mt-5">{ errorMessage }</p>
                    </form>
                )}
            </div>
        }/>
    );
}


// NotFound page
const NotFound = () => {
    return (
        <PageWrapper>
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold mb-4">404</h1>
                <p className="text-xl mb-4">Page Not Found</p>
                <p className="mb-8">The page you're looking for doesn't exist or has been moved.</p>
                <Link to="/dashboard" className="text-blue-500 hover:text-blue-700">
                    Go to Home
                </Link>
            </div>
        </PageWrapper>
    );
};


export {WelcomePage, NotFound, RegisterPage, LogInPage, LogoutPage, ResetPasswordPage, SetNewPasswordPage};