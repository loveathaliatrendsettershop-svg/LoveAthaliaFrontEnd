import React from 'react'
import './Change.css'
import logo from '../../Assets/logo.png'
import LOGIN from '../../Assets/LOGIN.png'
import checks from '../../Assets/checks.png'
import { useNavigate } from "react-router-dom"; 

const Change = () => {
    const navigate = useNavigate();
    return (
        <div className='change-main' style={{ backgroundImage: `url(${LOGIN})` }}>
            <div className='change-container'>
                <div className='change-header'>
                    <img src={logo}></img>
                </div>
                <div className='change-confirm'>
                    <img src={checks}></img>
                    <h2>Password Changed!</h2>
                    <p>Your password has been changed successfully.</p>
                </div>
                <button type='submit' className='change-submit' onClick={() => navigate("/Login")}>Back to Login</button>
            </div>

        </div>
    )
}

export default Change
