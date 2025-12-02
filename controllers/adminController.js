const adminRouter = require('express').Router()
const User = require('../models/user')
const Post = require('../models/post')
const { adminExtractor } = require('../utils/adminMiddleware')

adminRouter.get('/stats', adminExtractor, async (req, res, next) => {
  try {
    const users = await User.find({})
    const posts = await Post.find({})

    const totalUsers = users.length
    const totalPosts = posts.length
    const activeUsers = users.filter((u) => u.isActive).length

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const newUsersLast30Days = users.filter(
      (u) => new Date(u.createdAt) >= thirtyDaysAgo
    ).length

    const newPostsLast30Days = posts.filter(
      (p) => new Date(p.createdAt) >= thirtyDaysAgo
    ).length

    //  Utilisateur le plus actif (le plus de posts)
    const userPostCounts = {}
    posts.forEach((post) => {
      userPostCounts[post.userId] = (userPostCounts[post.userId] || 0) + 1
    })

    const mostActiveUserId = Object.keys(userPostCounts).reduce(
      (a, b) => (userPostCounts[a] > userPostCounts[b] ? a : b),
      null
    )

    const mostActiveUser = mostActiveUserId
      ? await User.findById(mostActiveUserId)
      : null

    const postsByType = {
      appartement: posts.filter((p) => p.type === 'appartement').length,
      studio: posts.filter((p) => p.type === 'studio').length,
      maison: posts.filter((p) => p.type === 'maison').length,
      chambre: posts.filter((p) => p.type === 'chambre').length,
    }

    const postsByRegion = {}
    posts.forEach((post) => {
      postsByRegion[post.region] = (postsByRegion[post.region] || 0) + 1
    })

    const avgPriceByType = {}
    Object.keys(postsByType).forEach((type) => {
      const postsOfType = posts.filter((p) => p.type === type)
      if (postsOfType.length > 0) {
        const totalPrice = postsOfType.reduce(
          (sum, p) => sum + parseFloat(p.price),
          0
        )
        avgPriceByType[type] = Math.round(totalPrice / postsOfType.length)
      } else {
        avgPriceByType[type] = 0
      }
    })

    res.json({
      general: {
        totalUsers,
        activeUsers,
        totalPosts,
        newUsersLast30Days,
        newPostsLast30Days,
      },
      mostActiveUser: mostActiveUser
        ? {
            id: mostActiveUser._id,
            name: `${mostActiveUser.firstName} ${mostActiveUser.lastName}`,
            email: mostActiveUser.email,
            postCount: userPostCounts[mostActiveUserId],
          }
        : null,
      postsByType,
      postsByRegion,
      avgPriceByType,
    })
  } catch (error) {
    console.error('  Error fetching admin stats:', error)
    next(error)
  }
})

adminRouter.get('/stats/timeline', adminExtractor, async (req, res, next) => {
  try {
    const { period = '30' } = req.query
    const days = parseInt(period)

    const users = await User.find({})
    const posts = await Post.find({})

    //  Créer un tableau pour chaque jour
    const timeline = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const usersOnDay = users.filter((u) => {
        const createdAt = new Date(u.createdAt)
        return createdAt >= date && createdAt < nextDate
      }).length

      const postsOnDay = posts.filter((p) => {
        const createdAt = new Date(p.createdAt)
        return createdAt >= date && createdAt < nextDate
      }).length

      timeline.push({
        date: date.toISOString().split('T')[0],
        users: usersOnDay,
        posts: postsOnDay,
      })
    }

    res.json(timeline)
  } catch (error) {
    console.error('  Error fetching timeline stats:', error)
    next(error)
  }
})

//Récupérer tous les utilisateurs
adminRouter.get('/users', adminExtractor, async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-passwordHash')
      .sort({ createdAt: -1 })

    res.json(users)
  } catch (error) {
    console.error('  Error fetching users:', error)
    next(error)
  }
})

adminRouter.get('/users/:id', adminExtractor, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash')

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const userPosts = await Post.find({ userId: req.params.id })

    res.json({
      user,
      stats: {
        totalPosts: userPosts.length,
        totalLikes: userPosts.reduce((sum, p) => sum + p.likes.length, 0),
        totalComments: userPosts.reduce((sum, p) => sum + p.comments.length, 0),
      },
    })
  } catch (error) {
    console.error(' Error fetching user:', error)
    next(error)
  }
})

adminRouter.delete('/users/:id', adminExtractor, async (req, res, next) => {
  try {
    const userId = req.params.id

    if (!userId || userId === 'undefined') {
      return res.status(400).json({ error: 'Invalid user ID' })
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    try {
      const deletedPosts = await Post.deleteMany({ userId })
      console.log(
        `✅ Deleted ${deletedPosts.deletedCount} posts for user ${userId}`
      )
    } catch (postError) {
      console.error('⚠️ Error deleting user posts:', postError)
      //  AJOUT: Continue même si la suppression des posts échoue
    }

    //  Supprimer l'utilisateur
    await User.findByIdAndDelete(userId)

    console.log(`✅ Admin deleted user ${userId}`)
    res.status(204).end()
  } catch (error) {
    console.error('  Error deleting user:', error)
    //  AJOUT: Retourner une erreur plus descriptive
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID format' })
    }
    next(error)
  }
})

adminRouter.patch(
  '/users/:id/toggle-status',
  adminExtractor,
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id)

      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      //  Inverser le statut
      user.isActive = !user.isActive
      await user.save()

      console.log(
        ` Admin toggled user ${req.params.id} status to ${user.isActive}`
      )
      res.json({ isActive: user.isActive })
    } catch (error) {
      console.error('  Error toggling user status:', error)
      next(error)
    }
  }
)

adminRouter.get('/posts', adminExtractor, async (req, res, next) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 })
    res.json(posts)
  } catch (error) {
    console.error('  Error fetching posts:', error)
    next(error)
  }
})

adminRouter.delete('/posts/:id', adminExtractor, async (req, res, next) => {
  try {
    const postId = req.params.id

    if (!postId || postId === 'undefined') {
      return res.status(400).json({ error: 'Invalid post ID' })
    }

    const post = await Post.findById(postId)

    if (!post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    await Post.findByIdAndDelete(postId)

    console.log(`✅ Admin deleted post ${postId}`)
    res.status(204).end()
  } catch (error) {
    console.error('  Error deleting post:', error)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid post ID format' })
    }
    next(error)
  }
})

adminRouter.delete(
  '/posts/:postId/comments/:commentId',
  adminExtractor,
  async (req, res, next) => {
    try {
      const post = await Post.findById(req.params.postId)

      if (!post) {
        return res.status(404).json({ error: 'Post not found' })
      }

      //  Filtrer le commentaire à supprimer
      post.comments = post.comments.filter((c) => c.id !== req.params.commentId)

      await post.save()

      console.log(
        `✅ Admin deleted comment ${req.params.commentId} from post ${req.params.postId}`
      )
      res.json(post)
    } catch (error) {
      console.error('  Error deleting comment:', error)
      next(error)
    }
  }
)

//Posts les plus populaires
adminRouter.get('/stats/top-posts', adminExtractor, async (req, res, next) => {
  try {
    const posts = await Post.find({})

    //  Post avec le plus de likes
    const postWithMostLikes = posts.reduce(
      (max, post) =>
        post.likes.length > (max.likes?.length || 0) ? post : max,
      {}
    )

    const postWithMostComments = posts.reduce(
      (max, post) =>
        post.comments.length > (max.comments?.length || 0) ? post : max,
      {}
    )

    res.json({
      mostLiked: postWithMostLikes._id
        ? {
            id: postWithMostLikes._id,
            content: postWithMostLikes.content.substring(0, 100),
            likes: postWithMostLikes.likes.length,
            author: postWithMostLikes.userName,
            type: postWithMostLikes.type,
            price: postWithMostLikes.price,
            location: `${postWithMostLikes.quartier}, ${postWithMostLikes.ville}`,
          }
        : null,
      mostCommented: postWithMostComments._id
        ? {
            id: postWithMostComments._id,
            content: postWithMostComments.content.substring(0, 100),
            comments: postWithMostComments.comments.length,
            author: postWithMostComments.userName,
            type: postWithMostComments.type,
            price: postWithMostComments.price,
            location: `${postWithMostComments.quartier}, ${postWithMostComments.ville}`,
          }
        : null,
    })
  } catch (error) {
    console.error('  Error fetching top posts:', error)
    next(error)
  }
})

//Utilisateurs les plus actifs
adminRouter.get('/stats/top-users', adminExtractor, async (req, res, next) => {
  try {
    const users = await User.find({})
    const posts = await Post.find({})

    //  Calculer l'activité de chaque utilisateur
    const userActivity = {}

    posts.forEach((post) => {
      if (!userActivity[post.userId]) {
        userActivity[post.userId] = {
          posts: 0,
          likes: 0,
          comments: 0,
        }
      }
      userActivity[post.userId].posts++
      userActivity[post.userId].likes += post.likes.length
      userActivity[post.userId].comments += post.comments.length
    })

    //  Créer le classement
    const topUsers = await Promise.all(
      Object.entries(userActivity)
        .sort((a, b) => {
          const scoreA = a[1].posts * 3 + a[1].likes + a[1].comments * 2
          const scoreB = b[1].posts * 3 + b[1].likes + b[1].comments * 2
          return scoreB - scoreA
        })
        .slice(0, 10)
        .map(async ([userId, activity]) => {
          const user = await User.findById(userId)
          return {
            id: userId,
            name: user
              ? `${user.firstName} ${user.lastName}`
              : 'Utilisateur inconnu',
            email: user?.email,
            avatar: user?.profilePicture,
            ...activity,
            activityScore:
              activity.posts * 3 + activity.likes + activity.comments * 2,
          }
        })
    )

    res.json(topUsers)
  } catch (error) {
    console.error('  Error fetching top users:', error)
    next(error)
  }
})

// Statistiques par ville
adminRouter.get('/stats/cities', adminExtractor, async (req, res, next) => {
  try {
    const posts = await Post.find({})

    //  Compter les posts par ville
    const citiesData = {}
    posts.forEach((post) => {
      const city = post.ville.toLowerCase()
      if (!citiesData[city]) {
        citiesData[city] = {
          count: 0,
          avgPrice: 0,
          totalPrice: 0,
        }
      }
      citiesData[city].count++
      citiesData[city].totalPrice += parseFloat(post.price)
    })

    //  Calculer le prix moyen et trier
    const topCities = Object.entries(citiesData)
      .map(([city, data]) => ({
        name: city,
        posts: data.count,
        avgPrice: Math.round(data.totalPrice / data.count),
      }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 10)

    res.json(topCities)
  } catch (error) {
    console.error('  Error fetching cities stats:', error)
    next(error)
  }
})

//  Récupérer les posts signalés
adminRouter.get('/reports', adminExtractor, async (req, res, next) => {
  try {
    //  Récupérer tous les posts avec signalements
    const posts = await Post.find({ 'reports.0': { $exists: true } })

    const reportedPosts = posts
      .map((p) => ({
        postId: p._id,
        content: p.content.substring(0, 100),
        author: p.userName,
        reportsCount: p.reports.length,
        lastReported: p.reports[p.reports.length - 1].timestamp,
        reports: p.reports,
      }))
      .sort((a, b) => b.reportsCount - a.reportsCount)

    res.json({
      total: reportedPosts.length,
      posts: reportedPosts,
    })
  } catch (error) {
    console.error('  Error fetching reports:', error)
    next(error)
  }
})

//  Générer un rapport Excel/PDF
adminRouter.get('/export/:format', adminExtractor, async (req, res, next) => {
  try {
    const { format } = req.params

    //  Récupérer toutes les données
    const users = await User.find({})
    const posts = await Post.find({})

    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: users.length,
        totalPosts: posts.length,
        activeUsers: users.filter((u) => u.isActive).length,
      },
      users: users.map((u) => ({
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
      posts: posts.map((p) => ({
        content: p.content.substring(0, 100),
        type: p.type,
        price: p.price,
        location: `${p.ville}, ${p.region}`,
        likes: p.likes.length,
        comments: p.comments.length,
        createdAt: p.createdAt,
      })),
    }

    //  Pour JSON (simple)
    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename=report.json')
      res.setHeader('Content-Type', 'application/json')
      return res.json(reportData)
    }

    //  Pour CSV (simple)
    if (format === 'csv') {
      const csv = [
        'Type,Contenu,Prix,Ville,Likes,Commentaires,Date',
        ...reportData.posts.map(
          (p) =>
            `${p.type},"${p.content}",${p.price},${p.location},${p.likes},${p.comments},${p.createdAt}`
        ),
      ].join('\n')

      res.setHeader('Content-Disposition', 'attachment; filename=report.csv')
      res.setHeader('Content-Type', 'text/csv')
      return res.send(csv)
    }

    res.status(400).json({ error: 'Format non supporté. Utilisez json ou csv' })
  } catch (error) {
    console.error('  Error generating report:', error)
    next(error)
  }
})

module.exports = adminRouter
