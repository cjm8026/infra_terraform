import json
import boto3
import os
import psycopg2

cognito_client = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID')

# Database connection parameters
DB_HOST = os.environ.get('DB_HOST')
DB_NAME = os.environ.get('DB_NAME')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_PORT = int(os.environ.get('DB_PORT', '5432'))

def lambda_handler(event, context):
    # Handle EventBridge warm-up ping
    if event.get('source') == 'aws.events' and event.get('detail-type') == 'Scheduled Event':
        print('Warm-up ping received from EventBridge')
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Lambda warmed up successfully'})
        }
    
    try:
        # Parse request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', event)
        
        query_type = body.get('queryType', 'default')
        
        # Handle Cognito delete
        if query_type == 'cognito_delete':
            user_id = body.get('userId')
            if not user_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'success': False, 'message': 'userId is required'})
                }
            
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=USER_POOL_ID,
                    Username=user_id
                )
                return {
                    'statusCode': 200,
                    'body': json.dumps({'success': True, 'message': f'User {user_id} deleted from Cognito'})
                }
            except cognito_client.exceptions.UserNotFoundException:
                return {
                    'statusCode': 200,
                    'body': json.dumps({'success': True, 'message': 'User not found in Cognito (already deleted)'})
                }
            except Exception as e:
                return {
                    'statusCode': 500,
                    'body': json.dumps({'success': False, 'message': f'Failed to delete from Cognito: {str(e)}'})
                }
        
        # Default: Query database (existing functionality)
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        
        cursor = conn.cursor()
        
        # Execute custom query if provided
        custom_query = body.get('query')
        if custom_query:
            cursor.execute(custom_query)
        else:
            # Default query: get all users
            cursor.execute("SELECT * FROM users WHERE deleted_at IS NULL")
        
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        result = {
            'table': 'users',
            'count': len(rows),
            'data': [dict(zip(columns, row)) for row in rows]
        }
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Query executed successfully',
                'result': result,
                'database': DB_NAME,
                'host': DB_HOST
            }, default=str)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error executing query',
                'error': str(e)
            })
        }
