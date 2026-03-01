import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authenticateToken } from '../../src/auth/auth.middleware'

// le mock :
vi.mock('jsonwebtoken')

describe('Auth Middleware', () => {
    let mockRequest: Partial<Request>
    let mockResponse: Partial<Response>
    let nextFunction: NextFunction = vi.fn()

    beforeEach(() => {
        mockRequest = {
            headers: {},
        }
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        }
        vi.clearAllMocks()
        process.env.JWT_SECRET = 'test-secret'
    })

    it('doit retourner 401 si le token est absent ', () => {
        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction,
        )

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: 'Token manquant',
        })
        expect(nextFunction).not.toHaveBeenCalled()
    })

    it('doit retourner 401 si le token est invalide ou expirée', () => {
        mockRequest.headers = { authorization: 'Bearer invalid-token' }
        ;(jwt.verify as any).mockImplementation(() => {
            throw new Error('Invalid token')
        })

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction,
        )

        expect(mockResponse.status).toHaveBeenCalledWith(401)
        expect(mockResponse.json).toHaveBeenCalledWith({
            error: 'Token invalide ou expiré',
        })
        expect(nextFunction).not.toHaveBeenCalled()
    })

    it('doit appeler next et attacher les données utilisateur si le token est valide', () => {
        const mockUserPayload = { userId: 1, email: 'test@example.com' }
        mockRequest.headers = { authorization: 'Bearer valid-token' }
        ;(jwt.verify as any).mockReturnValue(mockUserPayload)

        authenticateToken(
            mockRequest as Request,
            mockResponse as Response,
            nextFunction,
        )

        expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret')
        expect((mockRequest as Request).userId).toBe(mockUserPayload.userId)
        expect((mockRequest as Request).email).toBe(mockUserPayload.email)
        expect(nextFunction).toHaveBeenCalled()
    })
})
