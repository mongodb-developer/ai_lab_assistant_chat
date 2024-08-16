# design_review_service.py

from bson import ObjectId
from datetime import datetime
from flask import current_app
from .utils import get_collection, analyze_transcript

class DesignReviewService:
    @staticmethod
    def submit_review(user_id, review_data):
        review_data['user_id'] = ObjectId(user_id)
        review_data['status'] = 'SUBMITTED'
        review_data['submitted_at'] = datetime.utcnow()
        
        # Calculate scores
        review_data['completeness_score'] = DesignReviewService.calculate_completeness_score(review_data)
        review_data['skill_level_score'] = DesignReviewService.calculate_skill_level_score(review_data.get('skill_level'))
        review_data['application_status_score'] = DesignReviewService.calculate_application_status_score(review_data.get('application_status'))
        review_data['use_case_score'] = DesignReviewService.calculate_use_case_score(review_data.get('requirements', []))
        review_data['data_volume_score'] = DesignReviewService.calculate_data_volume_score(review_data.get('data_size'))
        review_data['uptime_sla_score'] = DesignReviewService.calculate_uptime_sla_score(review_data.get('uptime_sla'))
        review_data['previous_interaction_score'] = DesignReviewService.calculate_previous_interaction_score(review_data.get('team_members'))
        
        # Calculate total score
        review_data['total_score'] = sum([
            review_data['completeness_score'],
            review_data['skill_level_score'],
            review_data['application_status_score'],
            review_data['use_case_score'],
            review_data['data_volume_score'],
            review_data['uptime_sla_score'],
            review_data['previous_interaction_score']
        ])
        
        # Determine opportunity level
        if review_data['total_score'] >= 80:
            review_data['opportunity_level'] = 'High'
        elif review_data['total_score'] >= 50:
            review_data['opportunity_level'] = 'Medium'
        else:
            review_data['opportunity_level'] = 'Low'
        
        design_reviews_collection = get_collection('design_reviews')
        result = design_reviews_collection.insert_one(review_data)
        return str(result.inserted_id)

    @staticmethod
    def update_review_status(review_id, new_status, reviewer_id=None):
        update_data = {'status': new_status}
        if new_status == 'UNDER_REVIEW':
            update_data['review_started_at'] = datetime.utcnow()
        elif new_status == 'ACCEPTED':
            update_data['accepted_at'] = datetime.utcnow()
        elif new_status == 'REJECTED':
            update_data['rejected_at'] = datetime.utcnow()
        elif new_status == 'ASSIGNED':
            update_data['assigned_reviewer_id'] = ObjectId(reviewer_id)
            update_data['assigned_at'] = datetime.utcnow()
        elif new_status == 'SCHEDULED':
            update_data['scheduled_at'] = datetime.utcnow()
        elif new_status == 'COMPLETED':
            update_data['completed_at'] = datetime.utcnow()
        elif new_status == 'REPORT_SENT':
            update_data['report_sent_at'] = datetime.utcnow()

        result = get_collection('design_reviews').update_one(
            {'_id': ObjectId(review_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0

    @staticmethod
    def get_reviews_by_status(status):
        return list(current_app.db.design_reviews.find({'status': status}))

    @staticmethod
    def get_assigned_reviews(reviewer_id):
        return list(current_app.db.design_reviews.find({
            'assigned_reviewer_id': ObjectId(reviewer_id),
            'status': {'$in': ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS']}
        }))

    @staticmethod
    def assign_reviewer(review_id, reviewer_id):
        return DesignReviewService.update_review_status(review_id, 'ASSIGNED', reviewer_id)

    @staticmethod
    def schedule_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'SCHEDULED')

    @staticmethod
    def start_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'IN_PROGRESS')

    @staticmethod
    def complete_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'COMPLETED')

    @staticmethod
    def send_report(review_id):
        return DesignReviewService.update_review_status(review_id, 'REPORT_SENT')

    @staticmethod
    def get_review(review_id):
        design_reviews_collection = get_collection('design_reviews')
        review = design_reviews_collection.find_one({'_id': ObjectId(review_id)})
        if review:
            review['_id'] = str(review['_id'])
            if 'user_id' in review and isinstance(review['user_id'], ObjectId):
                review['user_id'] = str(review['user_id'])
        return review

    @staticmethod
    def update_review(review_id, update_data):
        try:
            current_app.logger.info(f"Updating review {review_id} with data: {update_data}")
            design_reviews_collection = get_collection('design_reviews')
            current_app.logger.info(f"Got collection: {design_reviews_collection}")
            
            result = design_reviews_collection.update_one(
                {'_id': ObjectId(review_id)},
                {'$set': update_data}
            )
            current_app.logger.info(f"Update result: {result.raw_result}")
            
            if result.matched_count > 0:
                if result.modified_count > 0:
                    current_app.logger.info(f"Successfully updated review {review_id}")
                    return True, "Updated"
                else:
                    current_app.logger.info(f"No changes made to review {review_id}")
                    return True, "No changes"
            else:
                current_app.logger.warning(f"Review {review_id} not found")
                return False, "Not found"
        except Exception as e:
            current_app.logger.error(f"Error updating design review {review_id}: {str(e)}", exc_info=True)
            return False, str(e)

    @staticmethod
    def delete_review(review_id):
        design_reviews_collection = get_collection('design_reviews')
        result = design_reviews_collection.delete_one({'_id': ObjectId(review_id)})
        return result.deleted_count > 0

    @staticmethod
    def get_all_reviews():
        design_reviews_collection = get_collection('design_reviews')
        return list(design_reviews_collection.find({}, {
            'full_name': 1,
            'company_name': 1,
            'application_status': 1,
            'skill_level': 1,
            'total_score': 1,
            'review_status': 1,
            'review_details': 1
        }))
    @staticmethod
    def create_review(review_data):
        try:
            design_reviews_collection = get_collection('design_reviews')
            result = design_reviews_collection.insert_one(review_data)
            return str(result.inserted_id)
        except Exception as e:
            current_app.logger.error(f"Error creating design review: {str(e)}")
            return None


    @staticmethod
    def update_transcript_path(review_id, file_path):
        return DesignReviewService.update_review(review_id, {'transcription_path': file_path})

    @staticmethod
    def update_review_analysis(review_id, analysis_result):
        update_data = {
            'what_we_heard': analysis_result.get('what_we_heard'),
            'key_issues': analysis_result.get('key_issues'),
            'what_we_advise': analysis_result.get('what_we_advise'),
            'references': analysis_result.get('references')
        }
        return DesignReviewService.update_review(review_id, update_data)

    @staticmethod
    def analyze_transcript(review_id, file_path):
        review = DesignReviewService.get_review(review_id)
        if not review:
            return None
        user_context = f"Application Status: {review.get('application_status', 'N/A')}, Skill Level: {review.get('skill_level', 'N/A')}"
        return analyze_transcript(file_path, user_context)
    
    @staticmethod
    def accept_review(review_id, admin_id):
        return DesignReviewService.update_review_status(review_id, 'ACCEPTED')

    @staticmethod
    def reject_review(review_id, admin_id):
        return DesignReviewService.update_review_status(review_id, 'REJECTED')

    @staticmethod
    def assign_reviewer(review_id, reviewer_id):
        return DesignReviewService.update_review_status(review_id, 'ASSIGNED', reviewer_id)

    @staticmethod
    def schedule_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'SCHEDULED')

    @staticmethod
    def start_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'IN_PROGRESS')

    @staticmethod
    def complete_review(review_id):
        return DesignReviewService.update_review_status(review_id, 'COMPLETED')

    @staticmethod
    def send_report(review_id):
        return DesignReviewService.update_review_status(review_id, 'REPORT_SENT')

    @staticmethod
    def get_reviews_by_status(status):
        return list(get_collection('design_reviews').find({'status': status}))

    @staticmethod
    def get_assigned_reviews(reviewer_id):
        return list(get_collection('design_reviews').find({
            'assigned_reviewer_id': ObjectId(reviewer_id),
            'status': {'$in': ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS']}
        }))

    @staticmethod
    def calculate_review_score(review_data):
        score = (
            DesignReviewService.calculate_completeness_score(
                review_data.get('full_name'),
                review_data.get('company_name'),
                review_data.get('application_status'),
                review_data.get('project_description'),
                review_data.get('sample_documents', []),
                review_data.get('sample_queries', []),
                review_data.get('model_ready')
            ) +
            DesignReviewService.calculate_skill_level_score(review_data.get('skill_level')) +
            DesignReviewService.calculate_application_status_score(review_data.get('application_status')) +
            DesignReviewService.calculate_use_case_score(review_data.get('requirements', [])) +
            DesignReviewService.calculate_data_volume_score(review_data.get('data_size')) +
            DesignReviewService.calculate_uptime_sla_score(review_data.get('uptime_sla')) +
            DesignReviewService.calculate_previous_interaction_score(review_data.get('team_members'))
        )
        return score

    @staticmethod
    def calculate_completeness_score(review_data):
        score = 0
        if review_data.get('full_name'): score += 5
        if review_data.get('company_name'): score += 5
        if review_data.get('application_status'): score += 5
        if review_data.get('project_description'): score += 5
        if review_data.get('sample_documents'): score += 5
        if review_data.get('sample_queries'): score += 5
        if review_data.get('model_ready') and isinstance(review_data['model_ready'], str):
            if review_data['model_ready'].lower() != 'yes': 
                score -= 5
        return score

    @staticmethod
    def calculate_skill_level_score(skill_level):
        if skill_level == 'Expert': return 15
        if skill_level == 'Intermediate': return 10
        if skill_level == 'Beginner': return 5
        return 0

    @staticmethod
    def calculate_application_status_score(application_status):
        if application_status == 'In production': return 15
        if application_status == 'In design phase': return 10
        if application_status == 'Not started': return 0
        return 0

    @staticmethod
    def calculate_use_case_score(requirements):
        score = 0
        use_cases = [
            'Transactional guarantees', 'Full-Text Search', 'Cross-Region HA',
            'Cloud to on-prem replication (or vice versa)', 'Time series capabilities',
            'Data tiering', 'Multi-cloud', 'Data modeling guidance',
            'Development assistance/guidance', 'Edge database (mobile or otherwise)'
        ]
        for use_case in use_cases:
            if use_case in requirements:
                score += 2
        return score

    @staticmethod
    def calculate_data_volume_score(data_size):
        if data_size and isinstance(data_size, str):
            data_size = data_size.replace('GB', '').strip()
            try:
                size = int(float(data_size))
                if size >= 1000: return 10
                if size >= 100: return 5
            except ValueError:
                pass
        return 0
    @staticmethod
    def calculate_uptime_sla_score(uptime_sla):
        if uptime_sla:
            try:
                if float(uptime_sla) >= 99.99: return 5
            except ValueError:
                pass
        return 0

    @staticmethod
    def calculate_previous_interaction_score(previous_interaction):
        if previous_interaction: return 5
        return 0