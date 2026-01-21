const { CognitoIdentityProviderClient, AdminDeleteUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const USER_POOL_ID = process.env.USER_POOL_ID || 'us-east-1_oesTGe9D5';

exports.handler = async (event) => {
    try {
        // Parse request body
        let body;
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
        } else {
            body = event.body || event;
        }
        
        const queryType = body.queryType || 'default';
        
        // Handle Cognito delete
        if (queryType === 'cognito_delete') {
            const userId = body.userId;
            if (!userId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'userId is required' })
                };
            }
            
            try {
                const command = new AdminDeleteUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: userId
                });
                
                await cognitoClient.send(command);
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        success: true, 
                        message: `User ${userId} deleted from Cognito` 
                    })
                };
            } catch (error) {
                if (error.name === 'UserNotFoundException') {
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ 
                            success: true, 
                            message: 'User not found in Cognito (already deleted)' 
                        })
                    };
                }
                
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        success: false, 
                        message: `Failed to delete from Cognito: ${error.message}` 
                    })
                };
            }
        }
        
        // Default: Return error for unsupported query types
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Unsupported queryType. Use "cognito_delete"',
                queryType: queryType
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Error processing request',
                error: error.message
            })
        };
    }
};
