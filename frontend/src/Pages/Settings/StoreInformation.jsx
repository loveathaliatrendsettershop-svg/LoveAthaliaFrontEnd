import './storeinformation.css'
import Topbar from '../../Components/notif/Topbar'
import Sidebar from '../../Components/sidebar/Sidebar'
import back from '../../Assets/back.png'
import logo from '../../Assets/logo.png'
import facebook from '../../Assets/facebook.png'
import client1 from '../../Assets/client.jpg'
import { useNavigate } from "react-router-dom";

const StoreInformation = () => {

  const navigate = useNavigate();


  return (
    <div className='storeinfo-con'>
      <Sidebar />
      <div className='store-information'>
        <Topbar />
        <div className='storeinfo-content'>
          <div className='settings-sidebar'>
            <div className='settings-header'>
              <button><img src={back} className='back' alt='back' onClick={() => navigate("/dashboard")}></img></button>
              <p>Settings</p>
            </div>
            <div className='settings-nav'>
              <ul>
                <li className='info'>Store Information</li>
                <li onClick={() => navigate("/usermanagement")}>User Management</li>
                <li onClick={() => navigate("/logreports")}>Log Reports</li>
                <li onClick={() => navigate("/Systempreferences")}>System Preferences</li>
                <li onClick={() => navigate("/backuprecovery")}>Backup & Recovery</li>
              </ul>
            </div>
          </div>
          <div className='storeinfo-main'>
            <div className='store-title'>
              <h2>Store Information</h2>
            </div>
            <div className='storemain-content'>
              <div className='store-description'>
                <div className='storedescription-logo'>
                  <img src={logo} alt='logo'></img>
                </div>
                <div className='description'>
                  <h3>Caloocan-based kidswear store since <b>2022</b></h3>
                  <h1>LOVE ATHALIA ESSENTIALS</h1>
                  <p>We are a Caloocan‑based kidswear store, proudly serving families since
                    2022. Offering both wholesale and retail options, we provide stylish
                    and affordable clothing for children of all ages. Shop with us for quality
                    apparel that blends comfort and charm.</p>
                </div>
              </div>

              <div className='team'>
                <h3>Meet the Team</h3>
                <img src={client1} alt='owner'></img>
                <h4>Shane Anne C. Gapas</h4>
                <p>Owner</p>
              </div>

              <div className='contacts'>
                <h3>Contact Us</h3>
                <div className='contact-details'>
                  <div className='details'>
                    <div className='facebook'>
                      <img src={facebook} alt='facebook'></img>
                      <p><a href='https://www.facebook.com/profile.php?id=100070071061317'>Love, Athalia Essentials</a></p>
                    </div>
                    <p>Phase 4 Barangay 176, Caloocan, Philippines, 1428</p>
                    <p>0956 934 5958</p>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default StoreInformation
