import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect } from 'react'
import { useState } from 'react'
import './CheckoutForm.css'
import useAxiosSecure from '../../hooks/useAxiosSecure'
import useAuth from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { updateStatus } from '../../api/bookings'
import { ImSpinner9 } from 'react-icons/im'
const CheckoutForm = ({ bookingInfo, closeModal }) => {
  const navigate = useNavigate()
  const stripe = useStripe()
  const elements = useElements()
  const { user } = useAuth()
  const [axiosSecure] = useAxiosSecure()
  const [cardError, setCardError] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [processing, setProcessing] = useState(false)

  //   1.  get clientSecret from backend
  useEffect(() => {
    if (bookingInfo.price > 0) {
      axiosSecure
        .post('/create-payment-intent', { price: bookingInfo.price })
        .then(res => {
          console.log(res.data.clientSecret)
          setClientSecret(res.data.clientSecret)
        })
    }
  }, [bookingInfo, axiosSecure])

  const handleSubmit = async event => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    const card = elements.getElement(CardElement)
    if (card === null) {
      return
    }

    const { error } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    })

    if (error) {
      console.log('error', error)
      setCardError(error.message)
    } else {
      setCardError('')
      // console.log('payment method', paymentMethod)
    }

    setProcessing(true)

    const { paymentIntent, error: confirmError } =
      await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: card,
          billing_details: {
            email: user?.email || 'unknown',
            name: user?.displayName || 'anonymous',
          },
        },
      })

    if (confirmError) {
      console.log(confirmError)
      setCardError(confirmError.message)
    }

    console.log('payment intent', paymentIntent)

    if (paymentIntent.status === 'succeeded') {
      // save payment information to the server
      const paymentInfo = {
        ...bookingInfo,
        transactionId: paymentIntent.id,
        date: new Date(),
      }
      axiosSecure.post('/bookings', paymentInfo).then(res => {
        console.log(res.data)
        if (res.data.insertedId) {
          updateStatus(bookingInfo.roomId, true)
            .then(data => {
              setProcessing(false)
              console.log(data)
              const text = `Booking Successful!, TransactionId: ${paymentIntent.id}`
              toast.success(text)
              navigate('/dashboard/my-bookings')
              closeModal()
            })
            .catch(err => console.log(err))
        }
      })
    }
  }

  return (
    <>
      <form className='my-2' onSubmit={handleSubmit}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
        <div className='flex mt-2 justify-around'>
          <button
            type='button'
            className='inline-flex justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={!stripe || !clientSecret || processing}
            className='inline-flex justify-center rounded-md border border-transparent bg-green-100 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2'
          >
            {processing ? (
              <ImSpinner9 className='m-auto animate-spin' size={24} />
            ) : (
              `Pay ${bookingInfo.price}$`
            )}
          </button>
        </div>
      </form>
      {cardError && <p className='text-red-600 ml-8'>{cardError}</p>}
    </>
  )
}

export default CheckoutForm
