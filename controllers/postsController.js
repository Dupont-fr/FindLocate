const postsRouter = require('express').Router()
const Post = require('../models/post')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')
const {
  sendPostCreatedEmail,
  sendPostReportEmail,
} = require('../utils/emailConfig')
const { getIO } = require('../utils/socketConfig')

postsRouter.get('/', async (req, res, next) => {
  try {
    const { userId, available, occupied } = req.query

    let filter = {}

    if (userId) {
      filter.userId = userId
    }

    if (available === 'true') {
      filter['occupancyStatus.isOccupied'] = false
    } else if (occupied === 'true') {
      filter['occupancyStatus.isOccupied'] = true
    }

    const posts = await Post.find(filter).sort({ createdAt: 1 })
    res.json(posts)
  } catch (error) {
    console.error('Error fetching posts:', error)
    next(error)
  }
})

postsRouter.post('/report', async (req, res, next) => {
  try {
    const { postId, reason, additionalInfo } = req.body

    if (!postId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: postId, reason',
      })
    }

    const post = await Post.findById(postId)
    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const reasonLabels = {
      spam: 'Spam ou publicité non sollicitée',
      fake: 'Fausse annonce ou arnaque',
      inappropriate: 'Contenu inapproprié ou offensant',
      duplicate: 'Annonce en double',
      'wrong-category': 'Mauvaise catégorie',
      'price-abuse': 'Prix abusif ou trompeur',
      harassment: 'Harcèlement ou intimidation',
      other: 'Autre raison',
    }

    const reasonLabel = reasonLabels[reason] || reason

    if (!post.reports) {
      post.reports = []
    }

    post.reports.push({
      reason: reasonLabel,
      additionalInfo: additionalInfo || '',
      timestamp: new Date(),
    })

    await post.save()
    console.log('Report saved for post:', postId)

    try {
      await sendPostReportEmail({
        postId: post._id,
        postTitle: post.content.substring(0, 100) + '...',
        postType: post.type,
        postPrice: post.price,
        postLocation: `${post.quartier}, ${post.ville}, ${post.region}`,
        postOwner: post.userName,
        postOwnerId: post.userId,
        reason: reasonLabel,
        additionalInfo: additionalInfo || 'Aucune information supplémentaire',
        reportedAt: new Date().toLocaleString('fr-FR'),
      })
      console.log('Report email sent to admin')
    } catch (emailError) {
      console.error('Error sending report email:', emailError.message)
    }

    res.status(200).json({
      message: 'Report submitted successfully',
      reported: true,
    })
  } catch (error) {
    console.error('Error reporting post:', error)
    next(error)
  }
})

postsRouter.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    res.json(post)
  } catch (error) {
    console.error('Error fetching post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

postsRouter.post('/', userExtractor, async (req, res, next) => {
  try {
    const { content, price, region, ville, quartier, type, images, videos } =
      req.body

    if (!content || !price || !region || !ville || !quartier || !type) {
      return res.status(400).json({
        error:
          'Missing required fields: content, price, region, ville, quartier, type',
      })
    }

    const validTypes = ['appartement', 'studio', 'maison', 'chambre']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      })
    }

    if (content.length < 10) {
      return res.status(400).json({
        error: 'Content must be at least 10 characters long',
      })
    }

    if (content.length > 2000) {
      return res.status(400).json({
        error: 'Content must not exceed 2000 characters',
      })
    }

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const newPost = new Post({
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      userAvatar:
        user.profilePicture ||
        'https://cdn-icons-png.flaticon.com/512/149/149071.png',
      content,
      price,
      region,
      ville,
      quartier,
      type,
      images: images || [],
      videos: videos || [],
      likes: [],
      comments: [],
    })

    const savedPost = await newPost.save()
    console.log('Post created:', savedPost.id)

    try {
      await sendPostCreatedEmail(user.email, {
        userName: `${user.firstName} ${user.lastName}`,
        postTitle:
          content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        postType: type,
        location: `${quartier}, ${ville}, ${region}`,
        price,
      })
      console.log('Confirmation email sent to:', user.email)
    } catch (emailError) {
      console.error('Error sending email:', emailError)
    }

    res.status(201).json(savedPost)
  } catch (error) {
    console.error('Error creating post:', error)
    next(error)
  }
})

postsRouter.put('/:id', userExtractor, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    const { content, price, region, ville, quartier, type, images, videos } =
      req.body

    if (type) {
      const validTypes = ['appartement', 'studio', 'maison', 'chambre']
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        })
      }
    }

    if (content !== undefined) {
      if (content.length < 10) {
        return res.status(400).json({
          error: 'Content must be at least 10 characters long',
        })
      }
      if (content.length > 2000) {
        return res.status(400).json({
          error: 'Content must not exceed 2000 characters',
        })
      }
    }

    if (content !== undefined) post.content = content
    if (price !== undefined) post.price = price
    if (region !== undefined) post.region = region
    if (ville !== undefined) post.ville = ville
    if (quartier !== undefined) post.quartier = quartier
    if (type !== undefined) post.type = type
    if (images !== undefined) post.images = images
    if (videos !== undefined) post.videos = videos

    const updatedPost = await post.save()
    console.log('Post updated:', updatedPost.id)

    res.json(updatedPost)
  } catch (error) {
    console.error('Error updating post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

postsRouter.patch('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const { likes, comments, action, commentId, replyId, replyData } = req.body

    if (likes !== undefined && !comments && !action) {
      const previousLikes = post.likes.length
      post.likes = likes
      const updated = await post.save()

      console.log('Post liked/unliked:', post._id)

      if (likes.length > previousLikes) {
        const lastLike = likes[likes.length - 1]
        const newLikerId =
          typeof lastLike === 'object' ? lastLike.userId : lastLike

        if (post.userId !== newLikerId) {
          try {
            const liker = await User.findById(newLikerId)

            if (liker) {
              const io = getIO()

              const notification = {
                type: 'like',
                postId: post._id,
                senderId: newLikerId,
                senderName: `${liker.firstName} ${liker.lastName}`,
                senderAvatar: liker.profilePicture || '/default-avatar.png',
                message: `${liker.firstName} ${liker.lastName} a aimé votre post`,
                postPreview: post.content.substring(0, 50) + '...',
                timestamp: new Date().toISOString(),
                recipientId: post.userId,
              }

              io.to(`user_${post.userId}`).emit(
                'notification:new-like',
                notification
              )
            }
          } catch (notificationError) {
            console.error(
              'Error sending notification:',
              notificationError.message
            )
          }
        }
      }

      return res.json(updated)
    }

    if (comments !== undefined && !action) {
      const previousCommentsCount = post.comments.length
      post.comments = comments
      const updated = await post.save()

      console.log('Comments updated for post:', post._id)

      if (comments.length > previousCommentsCount) {
        const newComment = comments[comments.length - 1]
        const commentAuthorId = newComment.userId || newComment.user

        if (post.userId !== commentAuthorId) {
          try {
            const commenter = await User.findById(commentAuthorId)

            if (commenter) {
              const io = getIO()

              const notification = {
                type: 'comment',
                postId: post._id,
                senderId: commentAuthorId,
                senderName: `${commenter.firstName} ${commenter.lastName}`,
                senderAvatar: commenter.profilePicture || '/default-avatar.png',
                message: `${commenter.firstName} ${commenter.lastName} a commenté votre post`,
                commentPreview:
                  (newComment.content || newComment.text || '').substring(
                    0,
                    50
                  ) +
                  ((newComment.content || newComment.text || '').length > 50
                    ? '...'
                    : ''),
                postPreview: post.content.substring(0, 50) + '...',
                timestamp: new Date().toISOString(),
                recipientId: post.userId,
              }

              io.to(`user_${post.userId}`).emit(
                'notification:new-comment',
                notification
              )
            }
          } catch (notificationError) {
            console.error(
              'Error sending notification:',
              notificationError.message
            )
          }
        }
      }

      return res.json(updated)
    }

    if (action) {
      if (action === 'addReply' && commentId && replyData) {
        const comment = post.comments.find((c) => c.id === commentId)
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found' })
        }

        comment.replies.push({
          ...replyData,
          id: replyData.id || Date.now().toString(),
          createdAt: new Date(),
          likes: [],
        })

        const updated = await post.save()
        console.log('Reply added to comment:', commentId)
        return res.json(updated)
      }

      if (action === 'toggleCommentLike' && commentId && req.body.likeData) {
        const comment = post.comments.find((c) => c.id === commentId)
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found' })
        }

        const existingLike = comment.likes.find(
          (l) => l.userId === req.body.likeData.userId
        )

        if (existingLike) {
          comment.likes = comment.likes.filter(
            (l) => l.userId !== req.body.likeData.userId
          )
        } else {
          comment.likes.push(req.body.likeData)
        }

        const updated = await post.save()
        console.log('Like toggled on comment:', commentId)
        return res.json(updated)
      }

      if (
        action === 'toggleReplyLike' &&
        commentId &&
        replyId &&
        req.body.likeData
      ) {
        const comment = post.comments.find((c) => c.id === commentId)
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found' })
        }

        const reply = comment.replies.find((r) => r.id === replyId)
        if (!reply) {
          return res.status(404).json({ error: 'Reply not found' })
        }

        const existingLike = reply.likes.find(
          (l) => l.userId === req.body.likeData.userId
        )

        if (existingLike) {
          reply.likes = reply.likes.filter(
            (l) => l.userId !== req.body.likeData.userId
          )
        } else {
          reply.likes.push(req.body.likeData)
        }

        const updated = await post.save()
        console.log('Like toggled on reply:', replyId)
        return res.json(updated)
      }
    }

    console.warn('PATCH called without recognized field:', req.body)
    res.status(400).json({ error: 'Invalid PATCH body' })
  } catch (error) {
    console.error('Error patching post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

postsRouter.delete('/:id', userExtractor, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    await Post.findByIdAndDelete(req.params.id)
    console.log('Post deleted:', req.params.id)

    res.status(204).end()
  } catch (error) {
    console.error('Error deleting post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

postsRouter.put('/:id/mark-occupied', userExtractor, async (req, res, next) => {
  try {
    const { tenantName, tenantContact, note } = req.body

    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({
        error: 'Only the owner can mark this property as occupied',
      })
    }

    if (post.occupancyStatus && post.occupancyStatus.isOccupied) {
      return res.status(400).json({
        error: 'This property is already marked as occupied',
      })
    }

    const occupiedBy = {
      name: tenantName || '',
      contact: tenantContact || '',
    }

    await post.markAsOccupied(occupiedBy, note)

    console.log('Post marked as occupied:', post.id)

    res.json({
      message: 'Property marked as occupied successfully',
      post: post.toJSON(),
    })
  } catch (error) {
    console.error('Error marking post as occupied:', error)
    next(error)
  }
})

postsRouter.put(
  '/:id/mark-available',
  userExtractor,
  async (req, res, next) => {
    try {
      const { note } = req.body

      const post = await Post.findById(req.params.id)

      if (!post) {
        return res.status(404).json({ error: 'Post not found' })
      }

      if (post.userId.toString() !== req.user.id) {
        return res.status(403).json({
          error: 'Only the owner can mark this property as available',
        })
      }

      if (!post.occupancyStatus || !post.occupancyStatus.isOccupied) {
        return res.status(400).json({
          error: 'This property is already marked as available',
        })
      }

      await post.markAsAvailable(note)

      console.log('Post marked as available:', post.id)

      res.json({
        message: 'Property marked as available successfully',
        post: post.toJSON(),
      })
    } catch (error) {
      console.error('Error marking post as available:', error)
      next(error)
    }
  }
)

postsRouter.get('/:id/occupancy-history', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    res.json({
      postId: post.id,
      currentStatus:
        post.occupancyStatus && post.occupancyStatus.isOccupied
          ? 'occupied'
          : 'available',
      history: post.occupancyStatus ? post.occupancyStatus.history : [],
    })
  } catch (error) {
    console.error('Error fetching occupancy history:', error)
    next(error)
  }
})

module.exports = postsRouter
