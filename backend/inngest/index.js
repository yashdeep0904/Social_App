import { Inngest } from "inngest";
import User from "../models/User.js";
import Connection from "../models/Connections.js";
import sendEmail from "../config/nodemailer.js";
import Story from "../models/Story.js";
import Message from "../models/Message.js";

export const inngest = new Inngest({id : "pingup-app"});

// inngest function to save user data to a database

const syncUserCreation = inngest.createFunction(
    {id:'sync-user-from-clerk',
    triggers: [{ event: 'clerk/user.created' }]
},
    
    async({event})=>{
        const {id,first_name,last_name,email_addresses, image_url}= event.data
        let username = email_addresses[0].email_address.split('@')[0]
        // check availability of a username

        const user = await User.findOne({username})
        if(user) {
            username = username + Math.floor(Math.random() *10000)
        }
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture : image_url,
            username,
        }
        await User.create(userData)
    }
)

const syncUserUpdation = inngest.createFunction(
    {id:'update-user-from-clerk',
    triggers: [
        { event: 'clerk/user.updated' }
    ]},
    
    async({event})=>{
        const {id,first_name,last_name,email_addresses, image_url}= event.data
        
        const updatedUserData = {
            email : email_addresses[0].email_address,
            full_name: first_name + " " + last_name,
            profile_picture: image_url
        }

        await User.findByIdAndUpdate(id,updatedUserData)
        
    }
)

const syncUserDeletion = inngest.createFunction(
    {id:'delete-user-from-clerk',
    triggers: [
        { event: 'clerk/user.deleted' }
    ]},
    
    async({event})=>{
        const {id} = event.data;
        
        await User.findByIdAndDelete(id)
        
    }
)

// inngest function to send remainder when a new connection request is added 

const sendNewConnectionRequestRemainder = inngest.createFunction(
    {
        id: "send-new-connection-request-remainder",
        triggers: [{ event: "app/connection-request" }]
    },
    async({event,step}) => {
        const{connectionId} = event.data;

        await step.run('send-connection-request-mail',async()=>{
            const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');
            const subject = `New Connection request`;

            await sendEmail({
                to:connection.to_user_id.email,
                subject
            })
            
        })
        const in24Hours = new Date(Date.now()+ 24*60*60*1000)
        await step.sleepUntil("wait-for-24-hours",in24Hours)
        await step.run('send-connection-request-remainder',async()=>{
            const connection = await Connection.findById(connectionId).populate('from_user_id to_user_id');

            if(connection.status === "accepted"){
                return {message: "Already accepted"}
            }
            const subject = `New connection request`
            await sendEmail({
                to: connection.to_user_id.email,
                subject
            })
            return {message:"remainder sent"}
        })
    }
)

// Inngest function to delete story after 24 hours
const deleteStory = inngest.createFunction(
    {
        id: 'story-delete',
        triggers: [
            {event: 'app/story.delelte'}
        ]
    },

    async({event,step})=>{
        const {storyId} = event.data
        const in24Hours = new Date(Date.now() + 244*60*60*1000)
        await step.sleepUntil('wait-for-24-hours',in24Hours)
        await step.run("delete-story", async()=>{
            await Story.findByIdAndDelete(storyId)
            return {message:"Story deleted"}
        })
    }
)

// inngest function for send notification
const sendNotificationofUnseenMessages = inngest.createFunction(
    {
       id : "send-unseen-messages-notification",
       triggers: [
        {cron : "TZ=America/New_York 0 9 * * *"}
       ]
    },
    async({step})=>{
        const messages = await Message.find({seen:false}).populate('to_user_id')
        const unseenCount = {}


        messages.map(message=>{
            unseenCount[message.to_user_id._id] = (unseenCount[message.to_user_id._id] || 0) + 1;
        })
        for(const userId in unseenCount){
            const user = await User.findById(userId);

            const subject = `You have ${unseenCount[userId]} unseen messages`
            const body = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Hi ${user.full_name},</h2>
              <p>You have ${unseenCount[userId]} unseen messages</p>
              <p>Click <a href="${process.env.FRONTEND_URL}/messages" style="color: #10b981;
            ">here</a> to view them</p>
              <br/>
              <p>Thanks,<br/>PingUp - Stay Connected</p>
            </div>`
           
            await sendEmail({
                to:user.email,
                subject,
                body
            })
        }
        return {message: "Notification sent."}
    }
)

export const functions = [
    syncUserCreation,syncUserUpdation,syncUserDeletion,sendNewConnectionRequestRemainder,sendNotificationofUnseenMessages
];