import React, { useEffect, useRef, useState } from 'react'
import { ImageIcon, SendHorizonal } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import api from '../api/axios';
import { addMessages, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';

const ChatBox = () => {
  // Ensure default fallback to empty array to avoid crashes on initial load
  const messages = useSelector((state) => state.messages?.messages || []);
  const { userId } = useParams()
  const { getToken } = useAuth()
  const dispatch = useDispatch()
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [user, setUser] = useState(null)
  const connections = useSelector((state) => state.connections?.connections || [])

  const fetchUserMessages = async () => {
    try {
      const token = await getToken()
      if (token && userId) {
        dispatch(fetchMessages({ token, userId }))
      }
    } catch (error) {
      toast.error(error.message) // Fixed typo: error.messages -> error.message
    }
  }

  const messagesEndRef = useRef(null)

  const sendMessage = async () => {
    try {
      if (!text && !image) return
      const token = await getToken()
      const formData = new FormData()

      formData.append('to_user_id', userId)
      formData.append('text', text)
      if (image) formData.append('image', image)

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        setText('')
        setImage(null)
        dispatch(addMessages(data.message))
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  // Fetch messages whenever userId changes
  useEffect(() => {
    if (userId) {
      fetchUserMessages()
    }

    return () => {
      dispatch(resetMessages())
    }
  }, [userId])

  // Sync current target user profile from connections or route params
  useEffect(() => {
    if (connections.length > 0 && userId) {
      const targetUser = connections.find(c => c._id === userId)
      if (targetUser) {
        setUser(targetUser)
      }
    }
  }, [connections, userId])

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Ensure safely sorted array for rendering
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )

  return user ? (
    <div className='flex flex-col h-screen'>
      <div className='flex items-center gap-2 p-2 md:px-10 xl:pl-2 bg-linear-to-r from-green-50 to-green-100 border-b border-gray-300'>
        <img src={user.profile_picture} alt="" className='size-8 rounded-full' />
        <div>
          <p className='font-medium'>{user.full_name}</p>
          <p className='text-sm text-gray-500 -mt-1.5'>@{user.username}</p>
        </div>
      </div>

      <div className='p-5 md:px-10 h-full overflow-y-scroll'>
        <div className='space-y-4 max-w-4xl mx-auto'>
          {sortedMessages.map((message, index) => (
            <div
              key={message._id || index}
              className={`flex flex-col ${message.to_user_id !== user._id ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`p-2 text-sm max-w-sm bg-white text-slate-700 rounded-lg shadow ${
                  message.to_user_id !== user._id ? 'rounded-bl-none' : 'rounded-br-none'
                }`}
              >
                {message.message_type === 'image' && (
                  <img
                    src={message.media_url}
                    alt=""
                    className='w-full max-w-sm rounded-lg mb-1'
                  />
                )}
                <p>{message.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className='px-4'>
        <div className='flex items-center gap-3 pl-5 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-200 shadow rounded-full mb-5'>
          <input
            type="text"
            className='flex-1 outline-none text-slate-700'
            placeholder='Type a message...'
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            onChange={(e) => setText(e.target.value)}
            value={text}
          />

          <label htmlFor="image">
            {image ? (
              <img
                src={URL.createObjectURL(image)}
                alt=""
                className='h-8 rounded'
              />
            ) : (
              <ImageIcon className='size-7 text-gray-400 cursor-pointer' />
            )}
            <input
              type="file"
              id='image'
              accept="image/*"
              hidden
              onChange={(e) => setImage(e.target.files[0])}
            />
          </label>

          <button
            onClick={sendMessage}
            className='bg-linear-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 active:scale-95 cursor-pointer text-white p-2 rounded-full'
          >
            <SendHorizonal size={18} />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className='flex items-center justify-center h-screen text-gray-500'>
      Loading chat...
    </div>
  )
}

export default ChatBox