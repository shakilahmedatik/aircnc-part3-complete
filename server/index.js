const express = require('express')
const app = express()
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const cors = require('cors')
require('dotenv').config()
const nodemailer = require('nodemailer')
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  // bearer token
  const token = authorization.split(' ')[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded
    next()
  })
}

// Send Email
const sendMail = (emailData, emailAddress) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASS,
    },
  })

  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.log(error)
    } else {
      console.log('Server is ready to take our messages')
    }
  })

  const mailOptions = {
    from: process.env.EMAIL,
    to: emailAddress,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`,
  }

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error)
    } else {
      console.log('Email sent: ' + info.response)
    }
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mq0mae1.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const usersCollection = client.db('aircncDb').collection('users')
    const roomsCollection = client.db('aircncDb').collection('rooms')
    const bookingsCollection = client.db('aircncDb').collection('bookings')

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      })

      res.send({ token })
    })

    // Save user email and role in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: user,
      }
      const result = await usersCollection.updateOne(query, updateDoc, options)
      res.send(result)
    })

    // Get user
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    // Get all rooms
    app.get('/rooms', async (req, res) => {
      const result = await roomsCollection.find().toArray()
      res.send(result)
    })

    // delete room
    app.delete('/rooms/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await roomsCollection.deleteOne(query)
      res.send(result)
    })

    // Get a single room
    app.get('/rooms/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      const query = { 'host.email': email }
      const result = await roomsCollection.find(query).toArray()
      res.send(result)
    })

    // Get a single room
    app.get('/room/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await roomsCollection.findOne(query)
      res.send(result)
    })

    // Save a room in database
    app.post('/rooms', verifyJWT, async (req, res) => {
      console.log(req.decoded)
      const room = req.body
      const result = await roomsCollection.insertOne(room)
      res.send(result)
    })

    // update room booking status
    app.patch('/rooms/status/:id', async (req, res) => {
      const id = req.params.id
      const status = req.body.status
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          booked: status,
        },
      }
      const update = await roomsCollection.updateOne(query, updateDoc)
      res.send(update)
    })

    // Update A room
    app.put('/rooms/:id', verifyJWT, async (req, res) => {
      const room = req.body
      console.log(room)

      const filter = { _id: new ObjectId(req.params.id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: room,
      }
      const result = await roomsCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })

    // Get bookings for guest
    app.get('/bookings', async (req, res) => {
      const email = req.query.email

      if (!email) {
        res.send([])
      }
      const query = { 'guest.email': email }
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })

    // Get bookings for host
    app.get('/bookings/host', async (req, res) => {
      const email = req.query.email

      if (!email) {
        res.send([])
      }
      const query = { host: email }
      const result = await bookingsCollection.find(query).toArray()
      res.send(result)
    })

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body
      const amount = parseFloat(price) * 100
      if (!price) return
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    // Save a booking in database
    app.post('/bookings', async (req, res) => {
      const booking = req.body
      const result = await bookingsCollection.insertOne(booking)
      if (result.insertedId) {
        // Send confirmation email to guest
        sendMail(
          {
            subject: 'Booking Successful!',
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${booking.transactionId}`,
          },
          booking?.guest?.email
        )
        // Send confirmation email to host
        sendMail(
          {
            subject: 'Your room got booked!',
            message: `Booking Id: ${result?.insertedId}, TransactionId: ${booking.transactionId}. Check dashboard for more info`,
          },
          booking?.host
        )
      }
      console.log(result)
      res.send(result)
    })

    // delete a booking

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await bookingsCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('AirCNC Server is running..')
})

app.listen(port, () => {
  console.log(`AirCNC is running on port ${port}`)
})
