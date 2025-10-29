const postsRouter = require('express').Router()
const Post = require('../models/post')
const User = require('../models/user')
const { userExtractor } = require('../utils/middleware')
const { sendPostCreatedEmail } = require('../utils/emailConfig')

// 📌 Récupérer tous les posts (ou filtrer par userId)
postsRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query

    let posts
    if (userId) {
      posts = await Post.find({ userId }).sort({ createdAt: -1 })
    } else {
      posts = await Post.find({}).sort({ createdAt: -1 })
    }

    res.json(posts)
  } catch (error) {
    console.error('❌ Erreur récupération posts:', error)
    next(error)
  }
})

// 📌 Récupérer un post par ID
postsRouter.get('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    res.json(post)
  } catch (error) {
    console.error('❌ Erreur récupération post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

// 📌 Créer un nouveau post (requiert authentification)
postsRouter.post('/', userExtractor, async (req, res, next) => {
  try {
    const { content, price, region, ville, quartier, type, images, videos } =
      req.body

    // Validation des champs obligatoires
    if (!content || !price || !region || !ville || !quartier || !type) {
      return res.status(400).json({
        error:
          'Missing required fields: content, price, region, ville, quartier, type',
      })
    }

    // Validation du type
    const validTypes = ['appartement', 'studio', 'maison', 'chambre']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      })
    }

    // Validation du contenu
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

    // Récupérer les infos de l'utilisateur
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Créer le post
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
    console.log('✅ Post créé avec succès:', savedPost.id)

    // 📧 Envoyer un email de confirmation
    try {
      await sendPostCreatedEmail(user.email, {
        userName: `${user.firstName} ${user.lastName}`,
        postTitle:
          content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        postType: type,
        location: `${quartier}, ${ville}, ${region}`,
        price,
      })
      console.log('✅ Email de confirmation envoyé à:', user.email)
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email (post créé quand même):', emailError)
      // On ne bloque pas la création du post si l'email échoue
    }

    res.status(201).json(savedPost)
  } catch (error) {
    console.error('❌ Erreur création post:', error)
    next(error)
  }
})

// 📌 Mettre à jour un post complet (PUT - requiert authentification)
postsRouter.put('/:id', userExtractor, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Vérifier que l'utilisateur est le propriétaire du post
    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    const { content, price, region, ville, quartier, type, images, videos } =
      req.body

    // Validation du type si fourni
    if (type) {
      const validTypes = ['appartement', 'studio', 'maison', 'chambre']
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        })
      }
    }

    // Validation du contenu si fourni
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

    // Mise à jour des champs
    if (content !== undefined) post.content = content
    if (price !== undefined) post.price = price
    if (region !== undefined) post.region = region
    if (ville !== undefined) post.ville = ville
    if (quartier !== undefined) post.quartier = quartier
    if (type !== undefined) post.type = type
    if (images !== undefined) post.images = images
    if (videos !== undefined) post.videos = videos

    const updatedPost = await post.save()
    console.log('✅ Post mis à jour:', updatedPost.id)

    res.json(updatedPost)
  } catch (error) {
    console.error('❌ Erreur mise à jour post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

// 📌 Mise à jour partielle (PATCH) - pour likes, comments, replies, etc.
postsRouter.patch('/:id', async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    const { likes, comments, action, commentId, replyId, replyData } = req.body

    // ✅ 1️⃣ Mise à jour des likes du post
    if (likes !== undefined && !comments && !action) {
      post.likes = likes
      const updated = await post.save()
      console.log(`👍 Post liké/déliké : ${post._id}`)
      return res.json(updated)
    }

    // ✅ 2️⃣ Mise à jour complète des commentaires
    if (comments !== undefined && !action) {
      post.comments = comments
      const updated = await post.save()
      console.log(`💬 Commentaires mis à jour pour le post : ${post._id}`)
      return res.json(updated)
    }

    // ✅ 3️⃣ Actions spécifiques (plus précises)
    if (action) {
      // --- Ajouter une réponse à un commentaire ---
      if (action === 'addReply' && commentId && replyData) {
        const comment = post.comments.find((c) => c.id === commentId)
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found' })
        }

        // On ajoute la nouvelle réponse
        comment.replies.push({
          ...replyData,
          id: replyData.id || Date.now().toString(),
          createdAt: new Date(),
          likes: [],
        })

        const updated = await post.save()
        console.log(`↩️ Réponse ajoutée au commentaire ${commentId}`)
        return res.json(updated)
      }

      // --- Liker / Déliker un commentaire ---
      if (action === 'toggleCommentLike' && commentId && req.body.likeData) {
        const comment = post.comments.find((c) => c.id === commentId)
        if (!comment) {
          return res.status(404).json({ error: 'Comment not found' })
        }

        const existingLike = comment.likes.find(
          (l) => l.userId === req.body.likeData.userId
        )

        if (existingLike) {
          // Supprimer le like (déliker)
          comment.likes = comment.likes.filter(
            (l) => l.userId !== req.body.likeData.userId
          )
        } else {
          // Ajouter le like
          comment.likes.push(req.body.likeData)
        }

        const updated = await post.save()
        console.log(`❤️ Like toggled sur le commentaire ${commentId}`)
        return res.json(updated)
      }

      // --- Liker / Déliker une réponse ---
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
        console.log(`💖 Like toggled sur la réponse ${replyId}`)
        return res.json(updated)
      }
    }

    // Si rien ne correspond
    console.warn('⚠️ PATCH appelé sans champ reconnu:', req.body)
    res.status(400).json({ error: 'Invalid PATCH body' })
  } catch (error) {
    console.error('❌ Erreur patch post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

// 📌 Supprimer un post (requiert authentification)
postsRouter.delete('/:id', userExtractor, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Vérifier que l'utilisateur est le propriétaire du post
    if (post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Permission denied' })
    }

    await Post.findByIdAndDelete(req.params.id)
    console.log('✅ Post supprimé:', req.params.id)

    res.status(204).end()
  } catch (error) {
    console.error('❌ Erreur suppression post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

module.exports = postsRouter
