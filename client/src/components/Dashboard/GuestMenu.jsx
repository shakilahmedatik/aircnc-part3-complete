import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BsFingerprint } from 'react-icons/bs'
import { GrUserAdmin } from 'react-icons/gr'
import { useContext } from 'react'
import { AuthContext } from '../../providers/AuthProvider'
import HostModal from '../Modal/HostRequestModal'
import { becomeHost } from '../../api/auth.js'
import { toast } from 'react-hot-toast'
const GuestMenu = () => {
  const { role, user, setRole } = useContext(AuthContext)
  const [modal, setModal] = useState(false)
  const modalHandler = email => {
    becomeHost(email).then(data => {
      console.log(data)
      toast.success('You are host now, Post Rooms!')
      setRole('host')
      closeModal()
    })
  }
  const closeModal = () => {
    setModal(false)
  }
  return (
    <>
      <NavLink
        to='my-bookings'
        className={({ isActive }) =>
          `flex items-center px-4 py-2 mt-5  transition-colors duration-300 transform  hover:bg-gray-300   hover:text-gray-700 ${
            isActive ? 'bg-gray-300  text-gray-700' : 'text-gray-600'
          }`
        }
      >
        <BsFingerprint className='w-5 h-5' />

        <span className='mx-4 font-medium'>My Bookings</span>
      </NavLink>

      {!role && (
        <div
          onClick={() => setModal(true)}
          className='flex items-center px-4 py-2 mt-5  transition-colors duration-300 transform text-gray-600  hover:bg-gray-300   hover:text-gray-700 cursor-pointer'
        >
          <GrUserAdmin className='w-5 h-5' />

          <span className='mx-4 font-medium'>Become A Host</span>
        </div>
      )}
      <HostModal
        email={user?.email}
        modalHandler={modalHandler}
        isOpen={modal}
        closeModal={closeModal}
      />
    </>
  )
}

export default GuestMenu
